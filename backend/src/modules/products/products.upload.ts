import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { AppError } from "../../shared/utils/errors.js";

export function imageType(data: Buffer): { mime: string; extension: string } {
  if (data.length >= 12) {
    if (data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { mime: "image/png", extension: "png" };
    if (data[0] === 255 && data[1] === 216 && data[2] === 255) return { mime: "image/jpeg", extension: "jpg" };
    if (data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", extension: "webp" };
  }
  throw new AppError(422, "INVALID_IMAGE", "Selecione uma imagem JPG, PNG ou WebP válida.");
}

export async function processProductImage(data: unknown): Promise<Buffer> {
  if (!Buffer.isBuffer(data) || data.length === 0 || data.length > 5 * 1024 * 1024) {
    throw new AppError(422, "INVALID_IMAGE", "Selecione uma imagem de até 5 MB.");
  }
  imageType(data);
  try {
    const pipeline = sharp(data, { limitInputPixels: 25_000_000, failOn: "warning" });
    const metadata = await pipeline.metadata();
    if (!metadata.width || !metadata.height || !["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) {
      throw new Error("Unsupported image");
    }
    // Re-encode pixels only: do not preserve EXIF, GPS, XMP or other metadata.
    const output = await pipeline.rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 }).timeout({ seconds: 15 }).toBuffer();
    if (output.length > 5 * 1024 * 1024) throw new Error("Output too large");
    return output;
  } catch {
    throw new AppError(422, "INVALID_IMAGE", "Imagem inválida ou muito grande. Use JPG, PNG ou WebP sem animação, com até 25 megapixels e 5 MB.");
  }
}

export async function uploadProductImage(data: unknown) {
  const processed = await processProductImage(data);
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new AppError(503, "UPLOAD_UNAVAILABLE", "O armazenamento das imagens ainda não foi configurado.");
  const bucket = "product-images";
  const path = `${randomUUID()}.webp`;
  try {
    const response = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "image/webp", "x-upsert": "false" },
      body: new Uint8Array(processed),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error("Storage upload failed");
  } catch {
    throw new AppError(503, "UPLOAD_FAILED", "Não foi possível enviar a imagem. Confira a configuração do armazenamento ou tente novamente.");
  }
  return { imageUrl: `${base}/storage/v1/object/public/${bucket}/${path}` };
}
