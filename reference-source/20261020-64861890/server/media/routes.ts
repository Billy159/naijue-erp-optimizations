import type {FastifyInstance, FastifyRequest} from 'fastify';
import type {AuthorizedContext, Selection} from '../security/service.js';
import {identifier, invalid, object, SecurityError} from '../security/errors.js';
import {registerBusinessRoute, registerBusinessWorkflowRoute, type AuthorizedBusinessWorkflow} from '../security/http.js';
import {mediaMetadata, mediaPathMatches, MediaStore, type MediaRecord} from './store.js';

function params(request: FastifyRequest): Record<string, unknown> {return object(request.params);}
function query(request: FastifyRequest): Record<string, unknown> {return object(request.query);}
function body(request: FastifyRequest): Record<string, unknown> {return object(request.body);}
function productId(request: FastifyRequest): string {return identifier(params(request)['productId'], true);}
function mediaId(request: FastifyRequest): string {return identifier(params(request)['mediaId'], true);}
function safeRequestKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) return invalid();
  return value;
}
function imageRecord(row: Record<string, unknown> | undefined): MediaRecord {
  if (!row || typeof row.id !== 'string' || typeof row.product_id !== 'string' || typeof row.path !== 'string'
    || typeof row.sha256 !== 'string' || typeof row.media_type !== 'string' || typeof row.role !== 'string'
    || row.color_name !== null && typeof row.color_name !== 'string' || typeof row.name !== 'string' || typeof row.sort_order !== 'number') {
    throw new SecurityError('MEDIA_MISSING', 404, '媒体记录不存在');
  }
  return row as unknown as MediaRecord;
}
function stageBody(request: FastifyRequest): {bytes: Buffer; declaredType: string; name: string; productId: string; requestKey: string} {
  const data = body(request), product = productId(request);
  const file = object(data['file']);
  if (data['productId'] !== product || typeof file['name'] !== 'string' || typeof file['base64'] !== 'string'
    || typeof data['declaredType'] !== 'string') return invalid();
  const encoded = file['base64'];
  // A repeated quartet group over an 8 MiB file can overflow V8's regexp stack.
  // The byte round-trip below still enforces canonical padding and pad bits.
  if (encoded.length > 11_184_812 || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return invalid();
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.toString('base64') !== encoded) return invalid();
  return {bytes, declaredType: data['declaredType'], name: file['name'], productId: product, requestKey: safeRequestKey(data['requestKey'])};
}
function stageSelection(request: FastifyRequest): {id: 'media.stageUpload'; selection: Selection; locks: readonly {scope: 'reference' | 'product'; key: string}[]} {
  const input = stageBody(request);
  return {id: 'media.stageUpload', selection: {kind: 'product', id: input.productId},
    locks: [{scope: 'product', key: input.productId}, {scope: 'reference', key: `media-upload:${input.productId}:${input.requestKey}`}]};
}
function associationSelection(request: FastifyRequest): {id: 'media.stageUpload'; selection: Selection; locks: readonly {scope: 'reference' | 'product'; key: string}[]} {
  const product = productId(request), input = body(request), stageId = identifier(input['mediaId'], true);
  return {id: 'media.stageUpload', selection: {kind: 'product', id: product},
    locks: [{scope: 'product', key: product}, {scope: 'reference', key: `media-upload:${product}:${stageId}`}]};
}
function productSelection(request: FastifyRequest): {id: 'media.stageUpload'; selection: Selection; locks: readonly {scope: 'reference' | 'product'; key: string}[]} {
  const product = productId(request), stageId = mediaId(request);
  return {id: 'media.stageUpload', selection: {kind: 'product', id: product},
    locks: [{scope: 'product', key: product}, {scope: 'reference', key: `media-upload:${product}:${stageId}`}]};
}

export function registerMediaRoutes(app: FastifyInstance, store: MediaStore): void {
  registerBusinessWorkflowRoute(app, {method: 'POST', url: '/api/media/:productId/stage', resolve: stageSelection,
    workflow: async ({actor, execute}, request) => {
      const input = stageBody(request), record = await store.stage({...input, actorId: actor.id});
      const attached = await execute(context => context.session.query<{id: string}>(`SELECT id::text FROM ${context.repo.runtime}.product_image WHERE id=$1::uuid`, [record.mediaId]));
      if (!attached.rows.length && Date.parse(record.expiresAt) <= Date.now()) throw new SecurityError('NOT_FOUND', 404, '媒体暂存令牌已过期');
      return store.token(record, attached.rows.length ? 'ATTACHED' : 'STAGED');
    }});

  registerBusinessWorkflowRoute(app, {method: 'POST', url: '/api/media/:productId/associate', resolve: associationSelection,
    workflow: async ({actor, execute}, request) => {
      const product = productId(request), input = body(request), id = identifier(input['mediaId'], true);
      const stage = await store.stageRecord(id, actor.id, product), metadata = mediaMetadata({name: input['name'] ?? stage.originalName,
        role: input['role'], colorName: input['colorName'], sortOrder: input['sortOrder']});
      const stored = await store.promote(stage);
      return execute(context => saveAssociation(context, store, stage, stored.path, product, metadata));
    }});

  registerBusinessWorkflowRoute(app, {method: 'PUT', url: '/api/media/:productId/replace/:imageId', resolve: request => {
    const product = productId(request), stageId = identifier(body(request)['mediaId'], true), image = identifier(params(request)['imageId'], true);
    return {id: 'media.stageUpload', selection: {kind: 'product', id: product},
      locks: [{scope: 'product', key: product}, {scope: 'reference', key: `media-upload:${product}:${stageId}`}, {scope: 'reference', key: `media-image:${image}`}]};
  }, workflow: async ({actor, execute}, request) => replaceAssociation(execute, actor.id, request, store)});

  registerBusinessWorkflowRoute(app, {method: 'DELETE', url: '/api/media/:productId/stage/:mediaId', resolve: productSelection,
    workflow: async ({actor, execute}, request) => {
      const stageId = mediaId(request), product = productId(request);
      const attached = await execute(context => context.session.query<{id: string}>(`SELECT id::text FROM ${context.repo.runtime}.product_image WHERE id=$1::uuid`, [stageId]));
      if (attached.rows.length) throw new SecurityError('VERSION_CONFLICT', 409, '已保存的媒体不能取消');
      await store.cancel(stageId, actor.id, product);
      return {mediaId: stageId, state: 'CANCELLED'};
    }});

  registerBusinessRoute(app, {method: 'GET', url: '/api/media/:mediaId', resolve: request => {
    const purpose = query(request)['purpose'] ?? 'original';
    if (purpose !== 'original' && purpose !== 'thumbnail') return invalid();
    return {id: 'media.read', selection: {kind: 'media', id: mediaId(request)}};
  }, handler: async (context, request) => {
    const id = mediaId(request), purpose = query(request)['purpose'] ?? 'original';
    const result = await context.session.query<MediaRecord>(`SELECT id::text,product_id::text,path,sha256,media_type,role,color_name,name,sort_order
      FROM ${context.repo.runtime}.product_image WHERE id=$1::uuid`, [id]);
    const row = imageRecord(result.rows[0] as unknown as Record<string, unknown> | undefined);
    const bytes = await store.read(row.sha256, row.media_type, purpose as 'original' | 'thumbnail');
    return {contentType: bytes.contentType, content: bytes.body.toString('base64')};
  }});
}

async function saveAssociation(context: AuthorizedContext, store: MediaStore, stage: Awaited<ReturnType<MediaStore['stageRecord']>>,
  storedPath: string, product: string, metadata: {name: string; role: string; colorName: string | null; sortOrder: number}): Promise<unknown> {
  const existing = await context.session.query<MediaRecord>(`SELECT id::text,product_id::text,path,sha256,media_type,role,color_name,name,sort_order
    FROM ${context.repo.runtime}.product_image WHERE id=$1::uuid`, [stage.mediaId]);
  if (existing.rows[0]) return verifyAttached(store, imageRecord(existing.rows[0] as unknown as Record<string, unknown>), stage, product, metadata);
  await context.session.query(`INSERT INTO ${context.repo.runtime}.product_image(id,product_id,path,sha256,media_type,role,color_name,name,sort_order)
    VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`,
  [stage.mediaId, product, storedPath, stage.checksum, stage.declaredType, metadata.role, metadata.colorName, metadata.name, metadata.sortOrder]);
  const saved = await context.session.query<MediaRecord>(`SELECT id::text,product_id::text,path,sha256,media_type,role,color_name,name,sort_order
    FROM ${context.repo.runtime}.product_image WHERE id=$1::uuid`, [stage.mediaId]);
  return verifyAttached(store, imageRecord(saved.rows[0] as unknown as Record<string, unknown> | undefined), stage, product, metadata);
}

async function replaceAssociation(execute: AuthorizedBusinessWorkflow['execute'], actorId: string, request: FastifyRequest, store: MediaStore): Promise<unknown> {
  const product = productId(request), currentId = identifier(params(request)['imageId'], true), input = body(request), id = identifier(input['mediaId'], true);
  const existing = await execute(context => context.session.query<MediaRecord>(`SELECT id::text,product_id::text,path,sha256,media_type,role,color_name,name,sort_order
    FROM ${context.repo.runtime}.product_image WHERE id=$1::uuid`, [id]));
  const stage = await store.stageRecord(id, actorId, product, existing.rows.length > 0);
  if (existing.rows[0]) {
    const row = imageRecord(existing.rows[0] as unknown as Record<string, unknown>);
    if (row.product_id !== product) throw new SecurityError('SCOPE', 403, '媒体未获授权或来源未知');
    if (!mediaPathMatches(row) || row.sha256 !== stage.checksum || row.media_type !== stage.declaredType) throw new SecurityError('VERSION_CONFLICT', 409, '替换请求与已保存媒体不一致');
    if (!await store.replacementHistoryExists(currentId, id)) throw new SecurityError('VERSION_CONFLICT', 409, '替换请求与原媒体不一致');
    return store.token(stage, 'ATTACHED');
  }
  const priorRows = await execute(context => context.session.query<MediaRecord>(`SELECT id::text,product_id::text,path,sha256,media_type,role,color_name,name,sort_order
    FROM ${context.repo.runtime}.product_image WHERE id=$1::uuid AND product_id=$2::uuid`, [currentId, product]));
  const prior = imageRecord(priorRows.rows[0] as unknown as Record<string, unknown> | undefined);
  if (prior.role.startsWith('history/')) throw new SecurityError('VERSION_CONFLICT', 409, '历史媒体不能作为当前素材替换');
  const stored = await store.promote(stage);
  await store.archiveReplacement(prior, actorId, id);
  return execute(async context => {
    const currentRows = await context.session.query<MediaRecord>(`SELECT id::text,product_id::text,path,sha256,media_type,role,color_name,name,sort_order
      FROM ${context.repo.runtime}.product_image WHERE id=$1::uuid AND product_id=$2::uuid FOR UPDATE`, [currentId, product]);
    const current = imageRecord(currentRows.rows[0] as unknown as Record<string, unknown> | undefined);
    if (!sameImage(current, prior)) throw new SecurityError('VERSION_CONFLICT', 409, '媒体已由其他请求替换，请重新读取');
    const retired = await context.session.query(`UPDATE ${context.repo.runtime}.product_image SET role=$1 WHERE id=$2::uuid AND product_id=$3::uuid`, [`history/${prior.role}`, currentId, product]);
    if (retired.rowCount !== 1) throw new SecurityError('VERSION_CONFLICT', 409, '原媒体状态已变化');
    await context.session.query(`INSERT INTO ${context.repo.runtime}.product_image(id,product_id,path,sha256,media_type,role,color_name,name,sort_order)
      VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9)`,
    [id, product, stored.path, stage.checksum, stage.declaredType, prior.role, prior.color_name, stage.originalName, prior.sort_order]);
    const saved = await context.session.query<MediaRecord>(`SELECT id::text,product_id::text,path,sha256,media_type,role,color_name,name,sort_order
      FROM ${context.repo.runtime}.product_image WHERE id=$1::uuid`, [id]);
    return verifyAttached(store, imageRecord(saved.rows[0] as unknown as Record<string, unknown> | undefined), stage, product,
      {name: stage.originalName, role: prior.role, colorName: prior.color_name, sortOrder: prior.sort_order});
  });
}

function sameImage(left: MediaRecord, right: MediaRecord): boolean {
  return left.id === right.id && left.product_id === right.product_id && left.path === right.path && left.sha256 === right.sha256
    && left.media_type === right.media_type && left.role === right.role && left.color_name === right.color_name
    && left.name === right.name && left.sort_order === right.sort_order;
}

function verifyAttached(store: MediaStore, row: MediaRecord, stage: Awaited<ReturnType<MediaStore['stageRecord']>>, product: string,
  metadata: {name: string; role: string; colorName: string | null; sortOrder: number}): unknown {
  if (row.product_id !== product || row.sha256 !== stage.checksum || row.media_type !== stage.declaredType || !mediaPathMatches(row)
    || row.name !== metadata.name || row.role !== metadata.role || row.color_name !== metadata.colorName || row.sort_order !== metadata.sortOrder) {
    throw new SecurityError('VERSION_CONFLICT', 409, '媒体记录与已保存文件不一致');
  }
  return store.token(stage, 'ATTACHED');
}
