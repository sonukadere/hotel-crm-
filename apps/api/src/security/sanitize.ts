/**
 * Output sanitisation.
 *
 * The last line of defence before a JSON response leaves the process:
 *  - identity numbers are always masked (the raw value never leaves the API)
 *  - payment gateway signatures are stripped (they are inbound-only secrets)
 *  - password hashes are stripped if a projection ever forgets to exclude them
 *
 * Applied to every `res.json(...)` by `responseSanitizer`.
 */

import { maskIdentityValue } from "./redaction";

const DROPPED_KEYS = new Set(["razorpaySignature", "password"]);

function sanitizeNode(value: unknown, key: string | null, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (key === "idNumber") return maskIdentityValue(value);
    return value;
  }

  if (typeof value !== "object") return value;
  if (depth > 25) return value;

  const object = value as object;
  if (seen.has(object)) return null;
  seen.add(object);

  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((entry) => sanitizeNode(entry, key, depth + 1, seen));

  const output: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
    if (DROPPED_KEYS.has(entryKey)) continue;
    output[entryKey] = sanitizeNode(entryValue, entryKey, depth + 1, seen);
  }
  return output;
}

export function sanitizeForClient<T>(value: T): T {
  return sanitizeNode(value, null, 0, new WeakSet()) as T;
}

/**
 * Detects a value that has already been masked (round-tripped from a client
 * that only ever received the masked copy). Such a value must never be written
 * back to storage as if it were the raw identity number.
 */
export function isMaskedIdentityValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.includes("*")) return true;
  const compact = trimmed.replace(/[\s-]/g, "");
  if (/^[0-9]{12}$/.test(compact)) return false; // raw Aadhaar
  if (/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(compact)) return false; // raw PAN
  return /X/i.test(trimmed);
}

/** Wraps `res.json` so no handler can accidentally serialise a raw secret. */
export function responseSanitizerMiddleware(
  _req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): void {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => originalJson(sanitizeForClient(body))) as import("express").Response["json"];
  next();
}
