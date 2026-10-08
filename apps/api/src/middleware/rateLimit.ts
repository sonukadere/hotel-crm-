import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

/**
 * Fixed-window rate limiter (in-process, no external dependency).
 *
 * Used globally to blunt brute-force / scraping traffic and much more tightly
 * around authentication endpoints. Redis is available in this stack, so this
 * can be swapped for a shared store if the API is ever scaled horizontally.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Human readable label used in the 429 message. */
  name: string;
  /** Defaults to client IP + route. */
  keyFor?: (req: Request) => string;
}

const buckets = new Map<string, Bucket>();
let pruneTimer: NodeJS.Timeout | null = null;

function ensurePruning(): void {
  if (pruneTimer) return;
  pruneTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, 60_000);
  pruneTimer.unref?.();
}

function clientKey(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `${ip}|${req.baseUrl}${req.path}`;
}

export function createRateLimit(options: RateLimitOptions) {
  const { windowMs, max, name } = options;
  const keyFor = options.keyFor ?? clientKey;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (env.NODE_ENV === "test") {
      next();
      return;
    }

    const now = Date.now();
    const key = keyFor(req);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
      ensurePruning();
    }

    bucket.count += 1;
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        success: false,
        message: `Too many requests for ${name}, please retry in ${retryAfterSeconds}s`,
        errors: ["RATE_LIMITED"],
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

/** Broad ceiling for the whole API surface (per client IP + route). */
export const globalRateLimit = createRateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  name: "api",
});

/**
 * Tight ceiling for credential endpoints, keyed by IP *and* submitted email so
 * an attacker cannot spray many accounts from one IP, nor hammer one account
 * from many.
 */
export const authRateLimit = createRateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  name: "authentication",
  keyFor: (req) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "";
    return `auth|${ip}|${email}`;
  },
});

/**
 * Guest-facing booking funnel: one bucket per IP across every public route,
 * so anonymous traffic cannot hammer inventory search or checkout.
 */
export const publicRateLimit = createRateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: Math.max(30, Math.floor(env.RATE_LIMIT_MAX / 2)),
  name: "public booking",
  keyFor: (req) => `public|${req.ip || req.socket.remoteAddress || "unknown"}`,
});

/** Test helper. */
export function clearRateLimitBuckets(): void {
  buckets.clear();
}
