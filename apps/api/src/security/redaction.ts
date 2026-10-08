/**
 * Redaction of sensitive values before they are written to the audit trail or
 * to application logs.
 *
 * Rules:
 *  - Authentication secrets (passwords, tokens, keys, signatures) are never stored.
 *  - Identity numbers (Aadhaar / PAN / passport / licence) are stored masked,
 *    never in full.
 *  - Everything else is kept so the audit trail stays useful.
 */

const REDACTED = "[REDACTED]";

/** Keys whose values must never be persisted anywhere. */
const SECRET_KEY_PATTERN =
  /(pass(word|phrase)?|secret|token|api[_-]?key|authorization|auth|cookie|signature|credential|private[_-]?key|client[_-]?secret|salt|hash|otp|cvv|pin)/i;

/** Keys that hold identity numbers: masked, never stored in full. */
const IDENTITY_KEY_PATTERN = /(aadhaar|aadhar|pan|passport|id[_-]?number|identity[_-]?number|voter|driving[_-]?licence|driving[_-]?license|gstin|card[_-]?number)/i;

function looksLikeLongNumber(value: string): boolean {
  return /^[0-9]{13,19}$/.test(value.replace(/[\s-]/g, ""));
}

/** Keeps the last four characters, masks everything else. */
export function maskTail(value: string): string {
  const cleaned = value.replace(/[\s-]/g, "");
  if (cleaned.length <= 4) return "****";
  return `${"*".repeat(Math.min(cleaned.length - 4, 12))}${cleaned.slice(-4)}`;
}

export function maskIdentityValue(value: string): string {
  const cleaned = value.replace(/[\s-]/g, "");
  if (/^[0-9]{12}$/.test(cleaned)) {
    // Aadhaar: XXXX-XXXX-last4
    return `XXXX-XXXX-${cleaned.slice(-4)}`;
  }
  if (/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(cleaned)) {
    // PAN: first 2 + **** + last 4
    return `${cleaned.slice(0, 2)}${"X".repeat(4)}${cleaned.slice(-4)}`.toUpperCase();
  }
  return maskTail(value);
}

function redactValue(key: string | null, value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (key && SECRET_KEY_PATTERN.test(key)) return REDACTED;
    if (key && IDENTITY_KEY_PATTERN.test(key)) return maskIdentityValue(value);
    if (!key && looksLikeLongNumber(value)) return maskTail(value);
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    if (key && SECRET_KEY_PATTERN.test(key)) return REDACTED;
    return typeof value === "bigint" ? value.toString() : value;
  }

  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object") {
    if (depth > 8) return "[TRUNCATED]";
    const obj = value as object;
    if (seen.has(obj)) return "[CIRCULAR]";
    seen.add(obj);

    if (Array.isArray(value)) {
      return value.slice(0, 200).map((entry) => redactValue(null, entry, depth + 1, seen));
    }

    // Prisma Decimal / other objects with a toJSON(): serialise then redact.
    const asRecord = value as Record<string, unknown>;
    if (typeof asRecord.toJSON === "function" && asRecord.toJSON.length === 0) {
      try {
        return redactValue(key, asRecord.toJSON(), depth + 1, seen);
      } catch {
        return "[UNSERIALIZABLE]";
      }
    }

    const output: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(asRecord)) {
      output[entryKey] = redactValue(entryKey, entryValue, depth + 1, seen);
    }
    return output;
  }

  if (typeof value === "function") return "[FUNCTION]";
  return String(value);
}

/**
 * Deep-clones a value with secrets removed and identity numbers masked.
 * Safe to `JSON.stringify` afterwards.
 */
export function redactSensitive<T>(value: T): T {
  return redactValue(null, value, 0, new WeakSet()) as T;
}

/** Message filter for log lines: strips obvious secrets from free text. */
export function redactLogMessage(message: string): string {
  return message
    .replace(/(password["']?\s*[:=]\s*)("[^"]*"|'[^']*'|\S+)/gi, `$1${REDACTED}`)
    .replace(/(bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, `$1${REDACTED}`)
    .replace(/((?:rzp_(?:live|test)_)\w+)/gi, REDACTED);
}
