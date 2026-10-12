import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { imageType, processProductImage, uploadProductImage } from "../../../src/modules/products/products.upload.js";

test("image processing strips metadata, corrects orientation and rejects corrupt or oversized inputs", async () => {
  const source = await sharp({ create: { width: 40, height: 20, channels: 3, background: "red" } })
    .jpeg().withMetadata({ orientation: 6 }).withExif({ IFD0: { Artist: "Private name" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "10/1 0/1 0/1" } }).toBuffer();
  assert.ok((await sharp(source).metadata()).exif);
  const output = await processProductImage(source);
  const meta = await sharp(output).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 20);
  assert.equal(meta.height, 40);
  assert.equal(meta.exif, undefined);
  assert.equal(meta.xmp, undefined);
  assert.equal(meta.icc, undefined);
  const big = await sharp({ create: { width: 5001, height: 5000, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(processProductImage(big), /Imagem inválida/);
  await assert.rejects(processProductImage(source.subarray(0, 100)), /Imagem inválida/);
  const transparent = await sharp({ create: { width: 2400, height: 1200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const resized = await sharp(await processProductImage(transparent)).metadata();
  assert.equal(resized.width, 2000);
  assert.equal(resized.height, 1000);
  assert.equal(resized.hasAlpha, true);
});

test("upload validates image signatures, size and storage response without exposing keys", async () => {
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } }).png().toBuffer();
  assert.equal(imageType(png).mime, "image/png");
  assert.throws(() => imageType(Buffer.from("<svg><script>bad</script></svg>")));
  await assert.rejects(uploadProductImage(Buffer.alloc(0)));
  await assert.rejects(uploadProductImage(Buffer.alloc(5 * 1024 * 1024 + 1)));
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await assert.rejects(uploadProductImage(png), /configurado/);
    process.env.SUPABASE_URL = "https://example.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-secret";
    globalThis.fetch = async (url, options) => {
      assert.match(String(url), /\/storage\/v1\/object\/product-images\/[\da-f-]+\.webp$/);
      assert.equal(options?.method, "POST");
      assert.equal(new Headers(options?.headers).get("Content-Type"), "image/webp");
      assert.equal((await sharp(Buffer.from(options?.body as Uint8Array)).metadata()).format, "webp");
      return new Response("{}", { status: 200 });
    };
    const result = await uploadProductImage(png);
    assert.match(result.imageUrl, /\/object\/public\/product-images\//);
    assert.equal(JSON.stringify(result).includes("test-only-secret"), false);
    globalThis.fetch = async () => new Response("private diagnostic", { status: 403 });
    await assert.rejects(uploadProductImage(png), error => error instanceof Error && !error.message.includes("private diagnostic"));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});
