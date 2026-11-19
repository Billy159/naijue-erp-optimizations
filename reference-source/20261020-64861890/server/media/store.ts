import {createHash, randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat, mkdir, open, readFile, readdir, realpath, rm, writeFile} from 'node:fs/promises';
import {basename, extname, join, relative, resolve, sep} from 'node:path';
import sharp from 'sharp';
import type {MediaConfig} from './config.js';
import {SecurityError} from '../security/errors.js';

export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
export const MAX_MEDIA_PIXELS = 40_000_000;
export const THUMBNAIL_EDGE = 480;
const stageLifetimeMs = 24 * 60 * 60 * 1000;
const durableObjectGraceMs = 7 * 24 * 60 * 60 * 1000;
type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';
type Variant = 'original' | 'thumbnail';

interface StageRecord {
  readonly version: 1;
  readonly state: 'STAGED' | 'CANCELLED';
  readonly mediaId: string;
  readonly checksum: string;
  readonly productId: string;
  readonly actorId: string;
  readonly requestKey: string;
  readonly declaredType: ImageType;
  readonly originalName: string;
  readonly width: number;
  readonly height: number;
  readonly thumbnailWidth: number;
  readonly thumbnailHeight: number;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface MediaToken {
  readonly mediaId: string;
  readonly checksum: string;
  readonly environment: string;
  readonly state: 'STAGED' | 'ATTACHED';
}

export interface MediaRecord {
  readonly id: string;
  readonly product_id: string;
  readonly path: string;
  readonly sha256: string;
  readonly media_type: string;
  readonly role: string;
  readonly color_name: string | null;
  readonly name: string;
  readonly sort_order: number;
}

export interface MediaBytes {
  readonly body: Buffer;
  readonly contentType: string;
  readonly etag: string;
}

interface RegisteredFile {
  readonly source: string;
  readonly sha256: string;
  readonly bytes: number;
}

export const FROZEN_BASELINE_COMMIT = 'b8bcfe3eb43f6a7be0c60a77c6d6fb99e2ed5dd3';

export interface RegisteredMediaIndexRecord {
  readonly source: string;
  readonly productCode: string;
  readonly variant: 'original' | 'legacy-thumbnail';
  readonly sourceSha256: string;
  readonly linkedOriginalSha256: string;
  readonly bytes: number;
  readonly role: null;
  readonly colorName: null;
  readonly sortOrder: null;
  readonly storageKey: string;
  readonly generatedThumbnailKey: string | null;
  readonly frozenBaselineCommit: string;
}

/** Add authoritative import provenance without changing the registered media identity fields. */
export function registeredMediaIndexRecord(
  record: Omit<RegisteredMediaIndexRecord, 'frozenBaselineCommit'>,
): RegisteredMediaIndexRecord {
  return {...record, frozenBaselineCommit: FROZEN_BASELINE_COMMIT};
}

function sha256(bytes: Buffer): string {return createHash('sha256').update(bytes).digest('hex');}
function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function fail(code: string, status = 400, message = '媒体请求无效'): never {throw new SecurityError(code, status, message);}
function imageType(bytes: Buffer): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
function extension(type: ImageType): string {return type === 'image/jpeg' ? '.jpg' : type === 'image/png' ? '.png' : '.webp';}
function objectKey(checksum: string, type: ImageType): string {
  return `objects/${checksum.slice(0, 2)}/${checksum}${extension(type)}`;
}
function thumbnailKey(checksum: string): string {return `thumbnails/${checksum.slice(0, 2)}/${checksum}.webp`;}
function within(parent: string, target: string): boolean {
  const relation = relative(parent, target);
  return relation === '' || relation !== '..' && !relation.startsWith('..' + sep) && !relation.startsWith(sep);
}
function safeName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 255 || value.includes('\0')) return fail('VALIDATION');
  const name = basename(value.trim().replaceAll('\\', '/')).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!name || name === '.' || name === '..' || name.length > 200) return fail('VALIDATION');
  return name;
}
function validRole(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(value)) return fail('VALIDATION');
  return value;
}
function validSortOrder(value: unknown): number {
  if (!Number.isSafeInteger(value) || typeof value !== 'number' || value < 0 || value > 1_000_000) return fail('VALIDATION');
  return value;
}

/** Private, content-addressed storage. Permanent files are append-only; cleanup only removes staged copies. */
export class MediaStore {
  readonly config: MediaConfig;
  #ready: Promise<void> | undefined;
  constructor(config: MediaConfig) {this.config = config;}

  async #ensure(): Promise<void> {
    this.#ready ??= this.#initialize();
    return this.#ready;
  }

  async #initialize(): Promise<void> {
    const root = this.config.root;
    await mkdir(root, {recursive: true, mode: 0o700});
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || (rootStat.mode & 0o077) !== 0 || rootStat.uid !== process.getuid?.()) throw new Error('MEDIA_ROOT_NOT_PRIVATE_DIRECTORY');
    const resolved = await realpath(root);
    if (resolved !== root) throw new Error('MEDIA_ROOT_SYMLINK_FORBIDDEN');
    const markerPath = join(root, '.media-environment.json');
    const expected = {schemaVersion: 1, environment: this.config.environment, instanceId: this.config.instanceId};
    try {
      const marker = JSON.parse(await readFile(markerPath, 'utf8')) as typeof expected;
      if (marker.schemaVersion !== expected.schemaVersion || marker.environment !== expected.environment || marker.instanceId !== expected.instanceId) throw new Error('MEDIA_ENVIRONMENT_MISMATCH');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const contents = await readdir(root);
      if (contents.length) throw new Error('UNMARKED_MEDIA_ROOT_NOT_EMPTY');
      const file = await open(markerPath, 'wx', 0o600);
      try {await file.writeFile(JSON.stringify(expected) + '\n'); await file.sync();} finally {await file.close();}
    }
    for (const folder of ['objects', 'thumbnails', 'staging', 'history', 'registered']) {
      const path = join(root, folder);
      await mkdir(path, {recursive: true, mode: 0o700});
      const info = await lstat(path);
      if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()) throw new Error('MEDIA_DIRECTORY_SYMLINK_FORBIDDEN');
    }
  }

  #stagePath(mediaId: string, suffix: string): string {
    if (!isUuid(mediaId) || !/^\.[a-z]+(?:\.[a-z]+)?$/.test(suffix)) return fail('VALIDATION');
    return join(this.config.root, 'staging', mediaId + suffix);
  }

  #requestIndexPath(actorId: string, productId: string, requestKey: string): string {
    const key = createHash('sha256').update(JSON.stringify([actorId, productId, requestKey])).digest('hex');
    return join(this.config.root, 'staging', 'request-' + key + '.json');
  }

  async #ensureChild(parent: string, child: string): Promise<void> {
    const target = join(parent, child);
    await mkdir(target, {recursive: true, mode: 0o700});
    const info = await lstat(target);
    if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()) throw new Error('MEDIA_DIRECTORY_SYMLINK_FORBIDDEN');
  }

  async #writeImmutable(relativePath: string, bytes: Buffer): Promise<void> {
    const target = resolve(this.config.root, relativePath);
    if (!within(this.config.root, target)) throw new Error('MEDIA_PATH_INVALID');
    const parent = resolve(target, '..');
    const relativeParent = relative(this.config.root, parent);
    const pieces = relativeParent.split(sep).filter(Boolean);
    let current = this.config.root;
    for (const piece of pieces) {await this.#ensureChild(current, piece); current = join(current, piece);}
    try {
      const file = await open(target, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      try {await file.writeFile(bytes); await file.sync();} finally {await file.close();}
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const info = await lstat(target);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error('MEDIA_OBJECT_NOT_REGULAR_FILE');
      const existing = await readFile(target);
      if (sha256(existing) !== sha256(bytes)) throw new Error('MEDIA_CONTENT_ADDRESS_COLLISION');
    }
  }

  async stage(input: {bytes: unknown; declaredType: unknown; name: unknown; productId: string; actorId: string; requestKey: unknown}): Promise<StageRecord> {
    await this.#ensure();
    if (!Buffer.isBuffer(input.bytes) || input.bytes.length < 16 || input.bytes.length > MAX_MEDIA_BYTES) return fail('VALIDATION', 400, '图片大小或内容无效');
    const detected = imageType(input.bytes);
    if (!detected || input.declaredType !== detected) return fail('VALIDATION', 400, '文件内容与图片类型不一致');
    const originalName = safeName(input.name);
    if (mimeFromName(originalName) !== detected) return fail('VALIDATION', 400, '文件扩展名与图片类型不一致');
    if (typeof input.requestKey !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.requestKey)) return fail('VALIDATION');
    let width = 0, height = 0, thumbnailWidth = 0, thumbnailHeight = 0;
    let thumbnail: Buffer;
    try {
      const image = sharp(input.bytes, {failOn: 'warning', limitInputPixels: MAX_MEDIA_PIXELS, animated: false});
      const metadata = await image.metadata();
      if (metadata.format !== detected.slice(6) || !metadata.width || !metadata.height || metadata.width * metadata.height > MAX_MEDIA_PIXELS || (metadata.pages ?? 1) !== 1) return fail('VALIDATION', 400, '仅支持有效的静态图片');
      width = metadata.width; height = metadata.height;
      const thumbnailResult = await sharp(input.bytes, {failOn: 'warning', limitInputPixels: MAX_MEDIA_PIXELS, animated: false})
        .rotate().resize(THUMBNAIL_EDGE, THUMBNAIL_EDGE, {fit: 'inside', withoutEnlargement: true})
        .webp({quality: 82}).toBuffer({resolveWithObject: true});
      thumbnail = thumbnailResult.data;
      thumbnailWidth = thumbnailResult.info.width;
      thumbnailHeight = thumbnailResult.info.height;
    } catch (error) {
      if (error instanceof SecurityError) throw error;
      return fail('VALIDATION', 400, '无法读取图片内容');
    }
    const checksum = sha256(input.bytes);
    const record: StageRecord = Object.freeze({version: 1, state: 'STAGED', mediaId: randomUUID(), checksum, productId: input.productId, actorId: input.actorId,
      requestKey: input.requestKey, declaredType: detected, originalName, width, height,
      thumbnailWidth, thumbnailHeight,
      createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + stageLifetimeMs).toISOString()});
    const indexPath = this.#requestIndexPath(input.actorId, input.productId, input.requestKey);
    try {
      const prior = JSON.parse(await readFile(indexPath, 'utf8')) as StageRecord;
      if (prior.actorId !== input.actorId || prior.productId !== input.productId || prior.requestKey !== input.requestKey || prior.checksum !== checksum) return fail('VERSION_CONFLICT', 409, '原上传请求已使用不同文件');
      if (prior.state === 'CANCELLED') return fail('VERSION_CONFLICT', 409, '原上传请求已取消');
      return prior;
    } catch (error) {
      if (error instanceof SecurityError) throw error;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    try {
      await writeFile(this.#stagePath(record.mediaId, '.bin'), input.bytes, {flag: 'wx', mode: 0o600});
      await writeFile(this.#stagePath(record.mediaId, '.thumb.webp'), thumbnail, {flag: 'wx', mode: 0o600});
      await writeFile(this.#stagePath(record.mediaId, '.json'), JSON.stringify(record) + '\n', {flag: 'wx', mode: 0o600});
      await writeFile(indexPath, JSON.stringify(record) + '\n', {flag: 'wx', mode: 0o600});
    } catch (error) {
      await Promise.all(['.bin', '.thumb.webp', '.json'].map(suffix => rm(this.#stagePath(record.mediaId, suffix), {force: true})));
      throw error;
    }
    return record;
  }

  token(record: StageRecord, state: MediaToken['state']): MediaToken {
    return Object.freeze({mediaId: record.mediaId, checksum: record.checksum, environment: this.config.environment, state});
  }

  async stageRecord(mediaId: string, actorId: string, productId: string, allowExpired = false): Promise<StageRecord> {
    await this.#ensure();
    try {
      const record = JSON.parse(await readFile(this.#stagePath(mediaId, '.json'), 'utf8')) as StageRecord;
      if (record.version !== 1 || record.mediaId !== mediaId || record.actorId !== actorId || record.productId !== productId) return fail('FORBIDDEN', 403, '媒体暂存令牌无效');
      if (record.state !== 'STAGED') return fail('VERSION_CONFLICT', 409, '媒体暂存令牌已取消');
      if (!allowExpired && Date.parse(record.expiresAt) <= Date.now()) return fail('NOT_FOUND', 404, '媒体暂存令牌已过期');
      return record;
    } catch (error) {
      if (error instanceof SecurityError) throw error;
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fail('NOT_FOUND', 404, '媒体暂存令牌不存在');
      throw new Error('MEDIA_STAGE_READ_FAILED');
    }
  }

  async promote(record: StageRecord): Promise<{path: string; thumbnailPath: string}> {
    await this.#ensure();
    let original: Buffer, thumbnail: Buffer;
    try {
      original = await readFile(this.#stagePath(record.mediaId, '.bin'));
      thumbnail = await readFile(this.#stagePath(record.mediaId, '.thumb.webp'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      original = await readFile(resolve(this.config.root, objectKey(record.checksum, record.declaredType)));
      thumbnail = await readFile(resolve(this.config.root, thumbnailKey(record.checksum)));
    }
    if (sha256(original) !== record.checksum || imageType(original) !== record.declaredType) return fail('VALIDATION', 400, '暂存文件完整性校验失败');
    await this.#writeImmutable(objectKey(record.checksum, record.declaredType), original);
    await this.#writeImmutable(thumbnailKey(record.checksum), thumbnail);
    return {path: objectKey(record.checksum, record.declaredType), thumbnailPath: thumbnailKey(record.checksum)};
  }

  async cancel(mediaId: string, actorId: string, productId: string): Promise<void> {
    const record = await this.stageRecord(mediaId, actorId, productId);
    await Promise.all(['.bin', '.thumb.webp'].map(suffix => rm(this.#stagePath(record.mediaId, suffix), {force: true})));
    const cancelled = {...record, state: 'CANCELLED' as const}, contents = JSON.stringify(cancelled) + '\n';
    const flags = constants.O_CREAT | constants.O_TRUNC | constants.O_WRONLY | constants.O_NOFOLLOW;
    for (const path of [this.#stagePath(record.mediaId, '.json'), this.#requestIndexPath(actorId, productId, record.requestKey)]) {
      const file = await open(path, flags, 0o600);
      try {await file.writeFile(contents); await file.sync();} finally {await file.close();}
    }
    // The request index remains a durable idempotency tombstone and prevents a canceled key from silently becoming new content.
  }

  async archiveReplacement(record: MediaRecord, actorId: string, requestMediaId: string): Promise<void> {
    await this.#ensure();
    if (!isUuid(record.id) || !isUuid(requestMediaId)) throw new Error('MEDIA_HISTORY_ID_INVALID');
    await this.#ensureChild(join(this.config.root, 'history'), record.id);
    const history = join(this.config.root, 'history', record.id, requestMediaId + '.json');
    const snapshot = {...record, originalRole: record.role.replace(/^history\//, ''), archivedBy: actorId, archivedAt: new Date().toISOString()};
    try {await writeFile(history, JSON.stringify(snapshot) + '\n', {flag: 'wx', mode: 0o600});}
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const prior = JSON.parse(await readFile(history, 'utf8')) as typeof snapshot;
      if (prior.id !== record.id || prior.sha256 !== record.sha256 || prior.product_id !== record.product_id) throw new Error('MEDIA_HISTORY_COLLISION');
    }
  }

  async replacementHistoryExists(recordId: string, requestMediaId: string): Promise<boolean> {
    if (!isUuid(recordId) || !isUuid(requestMediaId)) return false;
    await this.#ensure();
    try {
      const path = join(this.config.root, 'history', recordId, requestMediaId + '.json'), info = await lstat(path);
      return info.isFile() && !info.isSymbolicLink();
    } catch {return false;}
  }

  async read(checksum: unknown, type: unknown, variant: Variant): Promise<MediaBytes> {
    await this.#ensure();
    if (typeof checksum !== 'string' || !/^[0-9a-f]{64}$/.test(checksum)) return fail('VALIDATION');
    if (type !== 'image/jpeg' && type !== 'image/png' && type !== 'image/webp') return fail('VALIDATION');
    const mediaType = type as ImageType;
    const key = variant === 'thumbnail' ? thumbnailKey(checksum) : objectKey(checksum, mediaType);
    try {
      const path = resolve(this.config.root, key), info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error('MEDIA_OBJECT_NOT_REGULAR_FILE');
      const file = await readFile(path);
      if (variant === 'original' && (sha256(file) !== checksum || imageType(file) !== mediaType)) throw new Error('MEDIA_DIGEST_MISMATCH');
      if (variant === 'thumbnail' && imageType(file) !== 'image/webp') throw new Error('MEDIA_THUMBNAIL_INVALID');
      return {body: file, contentType: variant === 'thumbnail' ? 'image/webp' : mediaType, etag: `"${sha256(file)}"`};
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fail('MEDIA_MISSING', 503, '媒体文件暂不可用');
      throw error;
    }
  }

  async cleanupStaging(input: {now?: number; referencedIds: ReadonlySet<string>; referencedHashes: ReadonlySet<string>; backupHashes: ReadonlySet<string>}): Promise<{
    removed: number; retained: number; persistentFilesRemoved: number; persistentHashesCleaned: number; persistentBytesRemoved: number;
  }> {
    await this.#ensure();
    const registeredHashes = await this.#registeredHashes();
    const protectedHashes = new Set([...input.referencedHashes, ...input.backupHashes, ...registeredHashes]);
    const entries = await readdir(join(this.config.root, 'staging'));
    let removed = 0, retained = 0;
    const now = input.now ?? Date.now();
    for (const file of entries.filter(name => name.endsWith('.json') && !name.startsWith('request-'))) {
      const path = join(this.config.root, 'staging', file);
      let record: StageRecord;
      try {record = JSON.parse(await readFile(path, 'utf8')) as StageRecord;} catch {retained++; continue;}
      if (record.state === 'CANCELLED') {
        await Promise.all(['.bin', '.thumb.webp'].map(suffix => rm(this.#stagePath(record.mediaId, suffix), {force: true})));
        retained++;
        continue;
      }
      if (!isUuid(record.mediaId) || !/^[0-9a-f]{64}$/.test(record.checksum)
        || !['image/jpeg','image/png','image/webp'].includes(record.declaredType)) {retained++; continue;}
      if (Date.parse(record.expiresAt) > now) {
        if (record.state === 'STAGED') protectedHashes.add(record.checksum);
        retained++;
        continue;
      }
      const durableCopyExists = await this.#hasDurableObject(record.checksum, record.declaredType);
      const referenced = input.referencedIds.has(record.mediaId) || protectedHashes.has(record.checksum);
      if (referenced && !durableCopyExists) {retained++; continue;}
      await Promise.all((referenced ? ['.bin', '.thumb.webp'] : ['.bin', '.thumb.webp', '.json']).map(suffix => rm(this.#stagePath(record.mediaId, suffix), {force: true})));
      if (referenced) retained++; else removed++;
    }
    const durable = await this.#cleanupDurableObjects(protectedHashes, input.now ?? Date.now());
    return {removed, retained, ...durable};
  }

  async #registeredHashes(): Promise<Set<string>> {
    const path = join(this.config.root, 'registered', 't07-media-index.json');
    try {
      const index = JSON.parse(await readFile(path, 'utf8')) as {version?: unknown; records?: unknown};
      if (index.version !== 1 || !Array.isArray(index.records)) throw new Error('MEDIA_REGISTERED_INDEX_INVALID');
      const hashes = new Set<string>();
      for (const row of index.records) {
        if (!row || typeof row !== 'object' || !('sourceSha256' in row) || typeof row.sourceSha256 !== 'string'
          || !/^[0-9a-f]{64}$/.test(row.sourceSha256)) throw new Error('MEDIA_REGISTERED_INDEX_INVALID');
        hashes.add(row.sourceSha256);
      }
      return hashes;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Set();
      throw error;
    }
  }

  async #cleanupDurableObjects(protectedHashes: ReadonlySet<string>, now: number): Promise<{
    persistentFilesRemoved: number; persistentHashesCleaned: number; persistentBytesRemoved: number;
  }> {
    let persistentFilesRemoved = 0, persistentBytesRemoved = 0;
    const cleaned = new Set<string>();
    for (const folder of ['objects', 'thumbnails']) {
      const directory = join(this.config.root, folder);
      for (const prefix of await readdir(directory)) {
        if (!/^[0-9a-f]{2}$/.test(prefix)) continue;
        const prefixPath = join(directory, prefix), prefixStat = await lstat(prefixPath);
        if (!prefixStat.isDirectory() || prefixStat.isSymbolicLink() || (prefixStat.mode & 0o077) !== 0 || prefixStat.uid !== process.getuid?.()) continue;
        for (const fileName of await readdir(prefixPath)) {
          const match = folder === 'objects' ? fileName.match(/^([0-9a-f]{64})\.(?:jpg|png|webp)$/) : fileName.match(/^([0-9a-f]{64})\.webp$/);
          const checksum = match?.[1];
          if (!checksum || checksum.slice(0, 2) !== prefix || protectedHashes.has(checksum)) continue;
          const path = join(prefixPath, fileName), info = await lstat(path);
          if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()
            || now - info.mtimeMs < durableObjectGraceMs) continue;
          const content = await readFile(path);
          if (folder === 'objects' ? sha256(content) !== checksum : imageType(content) !== 'image/webp') continue;
          await rm(path);
          persistentFilesRemoved++;
          persistentBytesRemoved += info.size;
          cleaned.add(checksum);
        }
      }
    }
    return {persistentFilesRemoved, persistentHashesCleaned: cleaned.size, persistentBytesRemoved};
  }

  async #hasDurableObject(checksum: string, type: ImageType): Promise<boolean> {
    try {
      const path = resolve(this.config.root, objectKey(checksum, type)), info = await lstat(path);
      return info.isFile() && !info.isSymbolicLink() && sha256(await readFile(path)) === checksum;
    } catch {return false;}
  }

  /** Imports the exact, previously registered T07 media files; business association fields stay unknown. */
  async importRegisteredMedia(sourceRoot: string, manifestPath: string): Promise<{files: number; originals: number; legacyThumbnails: number; bytes: number; indexPath: string}> {
    await this.#ensure();
    const source = resolve(sourceRoot), manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as RegisteredFile[];
    const registered = manifest.filter(row => row.source.startsWith('frontend/assets/product-media/'));
    if (!registered.length || registered.length !== 134) throw new Error('T13_REGISTERED_MEDIA_MANIFEST_COUNT_MISMATCH');
    const records: RegisteredMediaIndexRecord[] = [];
    let originals = 0, legacyThumbnails = 0, bytesTotal = 0;
    for (const entry of registered) {
      const rel = entry.source;
      if (rel.includes('..') || rel.startsWith('/') || !/^frontend\/assets\/product-media\/[A-Za-z0-9_-]+\/[a-f0-9]{64}(?:\.thumb)?\.jpg$/.test(rel)) throw new Error('T13_REGISTERED_MEDIA_PATH_INVALID');
      const filePath = resolve(source, rel);
      if (!within(source, filePath)) throw new Error('T13_REGISTERED_MEDIA_PATH_INVALID');
      const info = await lstat(filePath);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error('T13_REGISTERED_MEDIA_FILE_INVALID');
      const content = await readFile(filePath), checksum = sha256(content);
      if (checksum !== entry.sha256 || content.length !== entry.bytes || imageType(content) !== 'image/jpeg') throw new Error('T13_REGISTERED_MEDIA_DIGEST_MISMATCH');
      const suffix = rel.endsWith('.thumb.jpg') ? '.thumb.jpg' : '.jpg';
      const sourceDigest = rel.split('/').at(-1)!.replace(/\.thumb\.jpg$|\.jpg$/, '');
      await this.#writeImmutable(objectKey(checksum, 'image/jpeg'), content);
      if (suffix === '.jpg') {
        originals++;
        const thumb = await sharp(content, {failOn: 'warning', limitInputPixels: MAX_MEDIA_PIXELS}).rotate()
          .resize(THUMBNAIL_EDGE, THUMBNAIL_EDGE, {fit: 'inside', withoutEnlargement: true}).webp({quality: 82}).toBuffer();
        await this.#writeImmutable(thumbnailKey(checksum), thumb);
      } else legacyThumbnails++;
      bytesTotal += content.length;
      const productCode = rel.split('/').at(3);
      if (!productCode) throw new Error('T13_REGISTERED_MEDIA_PATH_INVALID');
      records.push(registeredMediaIndexRecord({source: rel, productCode, variant: suffix === '.jpg' ? 'original' : 'legacy-thumbnail',
        sourceSha256: checksum, linkedOriginalSha256: sourceDigest, bytes: content.length, role: null, colorName: null, sortOrder: null,
        storageKey: objectKey(checksum, 'image/jpeg'), generatedThumbnailKey: suffix === '.jpg' ? thumbnailKey(checksum) : null}));
    }
    if (originals !== 67 || legacyThumbnails !== 67) throw new Error('T13_REGISTERED_MEDIA_PAIR_COUNT_MISMATCH');
    const indexPath = join(this.config.root, 'registered', 't07-media-index.json');
    const contents = JSON.stringify({version: 1, sourceManifest: 'outputs/T07/copied-source-manifest.json', importedAt: new Date().toISOString(),
      environment: this.config.environment, records}, null, 2) + '\n';
    await writeFile(indexPath, contents, {mode: 0o600});
    return {files: records.length, originals, legacyThumbnails, bytes: bytesTotal, indexPath};
  }
}

export function mediaPathMatches(row: Pick<MediaRecord, 'sha256' | 'media_type' | 'path'>): boolean {
  if (!/^[0-9a-f]{64}$/.test(row.sha256)) return false;
  if (row.media_type !== 'image/jpeg' && row.media_type !== 'image/png' && row.media_type !== 'image/webp') return false;
  return row.path === objectKey(row.sha256, row.media_type as ImageType);
}

export function mediaMetadata(input: {name: unknown; role: unknown; colorName: unknown; sortOrder: unknown}): {name: string; role: string; colorName: string | null; sortOrder: number} {
  const name = safeName(input.name), role = validRole(input.role), sortOrder = validSortOrder(input.sortOrder);
  if (input.colorName !== null && input.colorName !== undefined && (typeof input.colorName !== 'string' || input.colorName.length > 80 || input.colorName.includes('\0'))) return fail('VALIDATION');
  return {name, role, colorName: typeof input.colorName === 'string' ? input.colorName.trim() || null : null, sortOrder};
}

export function mimeFromName(value: string): ImageType | null {
  const suffix = extname(value).toLowerCase();
  return suffix === '.jpg' || suffix === '.jpeg' ? 'image/jpeg' : suffix === '.png' ? 'image/png' : suffix === '.webp' ? 'image/webp' : null;
}
