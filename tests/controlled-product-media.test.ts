/** Synthetic private manifests/files only. No image codec, real media mapping or database proof. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, realpath, writeFile, unlink, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { PrivateControlledProductMedia } from "../adapters/media/src/controlled-product-media.ts";
import type { PrivateProductMediaManifest } from "../adapters/media/src/controlled-product-media.ts";
import type { ProductImageMetadata } from "../packages/application/src/product-query-ports.ts";
import { DomainError } from "../packages/domain/src/errors.ts";
import { actor, sid } from "./support/synthetic-fixtures.ts";
const productId = sid("product", 12001), imageId = sid("product", 12002);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=", "base64");
function deferredVoid(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
const digest = createHash("sha256").update(png).digest("hex");
const image: ProductImageMetadata = { id: imageId, productId, fileRef: "PRIVATE_ORIGINAL_REF", mime: "image/png", byteSize: BigInt(png.length), displayOrder: 0 };
async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const temp = await mkdtemp(path.join(await realpath(tmpdir()), "controlled-media-synthetic-")); t.after(() => rm(temp, { recursive: true, force: true }));
  const original = path.join(temp, "original.png"), thumb = path.join(temp, "thumbnail.png"); await writeFile(original, png); await writeFile(thumb, png);
  let allowed = true, retained = true, auths = 0, reads = 0, mappings = 0;
  let manifest: PrivateProductMediaManifest = { productId, imageId, fileRef: image.fileRef,
    original: { rootKey: "private", relativePath: "original.png", mime: "image/png", byteSize: image.byteSize, sha256: digest },
    thumbnail: { rootKey: "private", relativePath: "thumbnail.png", mime: "image/png", byteSize: image.byteSize, sha256: digest, derivedFromOriginalSha256: digest } };
  const options = { deliveryOrigin: "https://synthetic.invalid", basePath: "/api", privateRoots: { private: temp }, publicRoots: [temp + "-public"],
    manifests: { async resolve() { mappings++; return new Map([[imageId, manifest]]); } },
    authorization: { async authorize() { auths++; if (!allowed) throw new DomainError("FORBIDDEN", "SYNTHETIC"); return { productId }; } },
    reader: { async readCurrentImage() { reads++; return retained ? image : null; } } };
  const provider = new PrivateControlledProductMedia(options), read = { actor, grant: { productId }, productId, images: [image], signal: new AbortController().signal };
  const input = async (variant: "thumbnail" | "original" = "thumbnail") => {
    const link = variant === "thumbnail" ? (await provider.resolveThumbnails(read))[0]! : await provider.resolveOriginal(read);
    return { actor, productId, imageId, revision: new URL(link.url).pathname.split("/").at(-2)!, variant, signal: read.signal };
  };
  return { provider, options, read, input, original, thumb, manifest: () => manifest, setManifest: (m: PrivateProductMediaManifest) => { manifest = m; }, revoke: () => { allowed = false; }, remove: () => { retained = false; }, counts: () => ({ auths, reads, mappings }) };
}
test("W15 media metadata links use one private batch and opaque revision without opening original; thumbnail delivery never falls back", async t => {
  const f = await fixture(t); await unlink(f.original);
  const links = await f.provider.resolveThumbnails(f.read); assert.equal(links.length, 1); assert.equal(f.counts().mappings, 1);
  assert.match(links[0]!.url, /\/api\/products\/media\/[^/]+\/[^/]+\/[a-f0-9]{64}\/thumbnail$/); assert.doesNotMatch(links[0]!.url, /PRIVATE|original\.png|thumbnail\.png/);
  const result = await f.provider.deliver(await f.input()); assert.deepEqual(result.bytes, png); assert.equal(result.mime, "image/png");
  await assert.rejects(f.provider.deliver(await f.input("original")), { code: "PRODUCT_MEDIA_NOT_READY" });
  f.setManifest({ ...f.manifest(), thumbnail: null });
  assert.deepEqual(await f.provider.resolveAvailableThumbnails(f.read), []); await assert.rejects(f.provider.resolveThumbnails(f.read), { code: "PRODUCT_MEDIA_NOT_READY" });
});
test("W15 bytes always reauthorize and reload membership; revoked, removed and stale revisions cannot read", async t => {
  const f = await fixture(t), input = await f.input(); await f.provider.deliver(input); await f.provider.deliver(input);
  assert.equal(f.counts().auths, 2); assert.equal(f.counts().reads, 2);
  await assert.rejects(f.provider.deliver({ ...input, revision: "0".repeat(64) }), { code: "PRODUCT_IMAGE_NOT_FOUND" });
  f.remove(); await assert.rejects(f.provider.deliver(input), { code: "PRODUCT_IMAGE_NOT_FOUND" });
  f.revoke(); const before = f.counts().reads; await assert.rejects(f.provider.deliver(input), { code: "FORBIDDEN" }); assert.equal(f.counts().reads, before);
  const controller = new AbortController(); controller.abort(); await assert.rejects(f.provider.deliver({ ...input, signal: controller.signal }), { code: "PRODUCT_READ_ABORTED" });
});
test("W15 path mapping rejects traversal/public roots/original aliases and symlink escapes", async t => {
  const f = await fixture(t), m = f.manifest();
  assert.throws(() => new PrivateControlledProductMedia({ ...f.options, publicRoots: [f.options.privateRoots.private] }), /separate/);
  for (const relativePath of ["../outside.png", "/tmp/outside.png", "x/../original.png", "https://example/image", "x%2f..", "x\\y"]) {
    f.setManifest({ ...m, original: { ...m.original, relativePath } }); await assert.rejects(f.provider.resolveThumbnails(f.read), { code: "PRODUCT_MEDIA_NOT_READY" });
  }
  f.setManifest({ ...m, thumbnail: { ...m.thumbnail!, relativePath: m.original.relativePath } }); await assert.rejects(f.provider.resolveThumbnails(f.read), { code: "PRODUCT_MEDIA_NOT_READY" });
  f.setManifest(m); await unlink(f.thumb); await symlink(f.original, f.thumb);
  await assert.rejects(f.provider.deliver(await f.input()), { code: "PRODUCT_MEDIA_NOT_READY" });
});
test("W15 changed blob digest, wrong membership and invalid private manifest fail explicitly without repair", async t => {
  const f = await fixture(t), input = await f.input(); await writeFile(f.thumb, Buffer.alloc(png.length, 1));
  await assert.rejects(f.provider.deliver(input), { code: "PRODUCT_MEDIA_NOT_READY" });
  const m = f.manifest(); f.setManifest({ ...m, fileRef: "WRONG_PRIVATE_REF" }); await assert.rejects(f.provider.resolveThumbnails(f.read), { code: "PRODUCT_MEDIA_NOT_READY" });
  f.setManifest(m); await assert.rejects(f.provider.resolveOriginal({ ...f.read, images: [] }), { code: "PRODUCT_MEDIA_NOT_READY" });
  await assert.rejects(f.provider.resolveThumbnails({ ...f.read, grant: { productId: sid("product", 3) } }), { code: "FORBIDDEN" });
  const html = Buffer.from("<html>not an image</html>"); await writeFile(f.thumb, html);
  f.setManifest({ ...m, thumbnail: { ...m.thumbnail!, byteSize: BigInt(html.length), sha256: createHash("sha256").update(html).digest("hex") } });
  await assert.rejects(f.provider.deliver(await f.input()), { code: "PRODUCT_MEDIA_NOT_READY" });
});
test("W15 private manifest batches preserve requested image order and reject an unknown ID", async t => {
  const f = await fixture(t), template = f.manifest();
  const images = Array.from({ length: 1000 }, (_, n) => ({
    ...image, id: sid("product", 13000 + n), fileRef: `SYNTHETIC_${n}`, displayOrder: n,
  }));
  const manifests = new Map(images.slice().reverse().map(i => [i.id, { ...template, imageId: i.id, fileRef: i.fileRef }]));
  const provider = new PrivateControlledProductMedia({ ...f.options, manifests: { async resolve() { return manifests; } } });
  const read = { ...f.read, images };
  const links = await provider.resolveThumbnails(read);
  assert.deepEqual(links.map(link => link.imageId), images.map(i => i.id));
  manifests.delete(images[0]!.id);
  const unknownId = sid("product", 14001);
  manifests.set(unknownId, { ...template, imageId: unknownId });
  await assert.rejects(provider.resolveThumbnails(read), { code: "PRODUCT_MEDIA_NOT_READY" });
});
test("W15 the same private revision is reauthorized after an account switch", async t => {
  const f = await fixture(t), input = await f.input();
  const switched = { ...actor, accountId: sid("account", 14002) };
  const attempts: string[] = [];
  const provider = new PrivateControlledProductMedia({
    ...f.options,
    authorization: { async authorize(current) {
      attempts.push(current.accountId);
      if (current.accountId === switched.accountId) throw new DomainError("FORBIDDEN", "SYNTHETIC");
      return { productId };
    } },
  });
  assert.deepEqual((await provider.deliver(input)).bytes, png);
  await assert.rejects(provider.deliver({ ...input, actor: switched }), { code: "FORBIDDEN" });
  assert.deepEqual(attempts, [actor.accountId, switched.accountId]);
  assert.equal(f.counts().reads, 1);
});

test("W15 abort during private manifest resolution returns cancellation instead of media", async t => {
  const f = await fixture(t), input = await f.input(), controller = new AbortController();
  const entered = deferredVoid(), release = deferredVoid();
  const provider = new PrivateControlledProductMedia({
    ...f.options,
    manifests: { async resolve() {
      entered.resolve();
      await release.promise;
      return new Map([[imageId, f.manifest()]]);
    } },
  });
  const delivery = provider.deliver({ ...input, signal: controller.signal });
  await entered.promise;
  controller.abort();
  release.resolve();
  await assert.rejects(delivery, { code: "PRODUCT_READ_ABORTED" });
});

test("W15 overlapping fresh media requests share one actual file open and read, never a completed read", async t => {
  const f = await fixture(t), input = await f.input();
  const fsPromises = createRequire(import.meta.url)("node:fs/promises") as typeof import("node:fs/promises");
  const realOpen = fsPromises.open;
  let opens = 0, reads = 0;
  const opened = deferredVoid(), releaseOpen = deferredVoid();
  const openMock = t.mock.method(fsPromises, "open", async (...args: Parameters<typeof realOpen>) => {
    const handle = await realOpen(...args);
    if (args[0] === f.thumb) {
      opens++;
      const realRead = handle.read.bind(handle);
      handle.read = ((...readArgs: Parameters<typeof realRead>) => {
        reads++;
        return Reflect.apply(realRead, handle, readArgs);
      }) as typeof handle.read;
      if (opens === 1) {
        opened.resolve();
        await releaseOpen.promise;
      }
    }
    return handle;
  });
  syncBuiltinESMExports();
  t.after(() => { openMock.mock.restore(); syncBuiltinESMExports(); });
  const controller = new AbortController();
  const cancelled = f.provider.deliver({ ...input, signal: controller.signal });
  const rejection = assert.rejects(cancelled, { code: "PRODUCT_READ_ABORTED" });
  const first = f.provider.deliver(input), second = f.provider.deliver(input);
  await opened.promise;
  controller.abort();
  await rejection;
  // Arrive after the first batch actually opened the file: this request must do fresh verification.
  const late = await f.provider.deliver(input);
  releaseOpen.resolve();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(opens, 2);
  assert.equal(reads, 4); // each read loop reads payload bytes then probes EOF
  assert.equal(f.counts().auths, 4);
  assert.equal(f.counts().reads, 4);
  a.bytes[0] = a.bytes[0]! ^ 0xff;
  assert.deepEqual(b.bytes, png);
  assert.deepEqual(late.bytes, png);
  // Same version, same file length, different bytes: never serve the previous result.
  await writeFile(f.thumb, Buffer.alloc(png.length, 12));
  await Promise.all([
    assert.rejects(f.provider.deliver(input), { code: "PRODUCT_MEDIA_NOT_READY" }),
    assert.rejects(f.provider.deliver(input), { code: "PRODUCT_MEDIA_NOT_READY" }),
  ]);
  assert.equal(opens, 3);
});

test("W15 a response buffer copy failure settles every affected waiter and leaves no reusable read", async t => {
  const f = await fixture(t), input = await f.input(), fakeSnapshot = Buffer.from(png);
  const testOnly = f.provider as unknown as { bytes: () => Promise<Buffer> };
  const readMock = t.mock.method(testOnly, "bytes", async () => fakeSnapshot);
  const realFrom = Buffer.from;
  const copyMock = t.mock.method(Buffer, "from", (...args: Parameters<typeof realFrom>) => {
    if (Object.is(args[0], fakeSnapshot)) throw Error("synthetic copy failure");
    return Reflect.apply(realFrom, Buffer, args) as Buffer;
  });
  try {
    await Promise.all([
      assert.rejects(f.provider.deliver(input), { code: "PRODUCT_MEDIA_NOT_READY" }),
      assert.rejects(f.provider.deliver(input), { code: "PRODUCT_MEDIA_NOT_READY" }),
    ]);
    assert.equal(readMock.mock.callCount(), 1);
    assert.deepEqual((await f.provider.deliver(input)).bytes, png);
    assert.equal(readMock.mock.callCount(), 2);
  } finally { copyMock.mock.restore(); }
});
