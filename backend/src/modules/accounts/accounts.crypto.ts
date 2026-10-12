import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export function newCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
export function secretHash(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function matchesHash(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "hex"),
    b = Buffer.from(actual, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
