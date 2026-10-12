import assert from "node:assert/strict";
import { test } from "node:test";
import { imageType, uploadProductImage } from "../../../src/modules/products/products.upload.js";

test("upload validates image signatures, size and storage response without exposing keys", async () => {
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(12)]);
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
      assert.match(String(url), /\/storage\/v1\/object\/product-images\/[\da-f-]+\.png$/);
      assert.equal(options?.method, "POST");
      assert.equal(new Headers(options?.headers).get("Content-Type"), "image/png");
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
