import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Secure password handling.
 *
 * Passwords are stored as salted scrypt hashes. Plaintext passwords are never
 * logged, never returned by the API and never written to the audit trail.
 */

const KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const MAXMEM = 64 * 1024 * 1024;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const HASH_PREFIX = "scrypt";

/**
 * A real (but unusable) hash used to burn the same amount of CPU when an
 * account does not exist or a stored hash is malformed, so response timing
 * cannot be used to enumerate users or detect legacy hashes.
 */
const DUMMY_HASH = buildHash("timing-equalisation-placeholder", randomBytes(16));

export class PasswordPolicyError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super("Password does not meet the password policy");
    this.name = "PasswordPolicyError";
    this.errors = errors;
  }
}

/** Unicode-normalise so the same typed password always derives the same key. */
function normalize(password: string): string {
  return password.normalize("NFKC");
}

function derive(password: string, salt: Buffer, length: number, N: number, r: number, p: number): Buffer {
  return scryptSync(normalize(password), salt, length, { N, r, p, maxmem: MAXMEM });
}

function buildHash(password: string, salt: Buffer): string {
  const hash = derive(password, salt, KEY_LENGTH, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return [HASH_PREFIX, SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64"), hash.toString("base64")].join("$");
}

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "passw0rd123",
  "1234567890",
  "qwertyuiop",
  "iloveyou123",
  "admin123456",
  "welcome1234",
  "hotel123456",
  "indianhotel",
]);

export function collectPasswordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    issues.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    issues.push(`Password must be at most ${PASSWORD_MAX_LENGTH} characters long`);
  }
  if (!/[a-z]/.test(password)) issues.push("Password must contain a lowercase letter");
  if (!/[A-Z]/.test(password)) issues.push("Password must contain an uppercase letter");
  if (!/[0-9]/.test(password)) issues.push("Password must contain a digit");
  if (!/[^A-Za-z0-9]/.test(password)) issues.push("Password must contain a symbol");
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    issues.push("Password is too common, please choose a different password");
  }
  return issues;
}

export function assertPasswordPolicy(password: string): void {
  const issues = collectPasswordIssues(password);
  if (issues.length > 0) throw new PasswordPolicyError(issues);
}

export function hashPassword(password: string): string {
  assertPasswordPolicy(password);
  return buildHash(password, randomBytes(16));
}

export function isPasswordHashed(value: string | null | undefined): boolean {
  if (!value) return false;
  const parts = value.split("$");
  return parts[0] === HASH_PREFIX && parts.length === 6;
}

function burnDummy(password: string): void {
  verifyAgainst(password, DUMMY_HASH);
}

function verifyAgainst(password: string, storedHash: string): boolean {
  const parts = storedHash.split("$");
  if (parts[0] !== HASH_PREFIX || parts.length !== 6) return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const saltStr = parts[4];
  const expectedStr = parts[5];
  if (!saltStr || !expectedStr) return false;

  const salt = Buffer.from(saltStr, "base64");
  const expected = Buffer.from(expectedStr, "base64");
  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = derive(password, salt, expected.length, N, r, p);
  } catch {
    return false;
  }

  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/**
 * Constant-time verification of a password against a stored hash.
 * Missing or malformed/legacy hashes (e.g. placeholder seeds) fail closed
 * without revealing which of the two cases occurred.
 */
export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !isPasswordHashed(storedHash)) {
    burnDummy(password);
    return false;
  }
  return verifyAgainst(password, storedHash);
}
