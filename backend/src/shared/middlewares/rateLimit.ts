import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors.js";

interface Options {
  windowMs: number;
  max: number;
}

interface Entry {
  count: number;
  resetAt: number;
}

export function createRateLimiter({ windowMs, max }: Options) {
  const hits = new Map<string, Entry>();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  cleanup.unref();

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      throw new AppError(429, "RATE_LIMITED", "Muitas solicitações. Tente novamente mais tarde.");
    }

    next();
  };
}
