import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * Minimal HS256 JWT implementation (no third-party dependency).
 *
 * Only access tokens are issued. The secret is read from the validated
 * environment and must never be logged or echoed back to a client.
 */

export interface AccessTokenClaims {
  /** User id */
  sub: string;
  email: string;
  name: string;
  role: string;
  hotelId?: string | null;
  /** Token id - used to revoke individual tokens (logout / password change). */
  jti: string;
  iat: number;
  exp: number;
}

export interface SignAccessTokenInput {
  sub: string;
  email: string;
  name: string;
  role: string;
  hotelId?: string | null;
}

const ALGORITHM = "HS256";
const CLOCK_SKEW_SECONDS = 60;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function hmac(data: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

export function signAccessToken(
  input: SignAccessTokenInput,
  secret: string,
  expiresInSeconds: number,
  now: number = Math.floor(Date.now() / 1000),
): { token: string; claims: AccessTokenClaims } {
  if (!secret || secret.length < 32) {
    throw new Error("JWT secret must be at least 32 characters");
  }

  const claims: AccessTokenClaims = {
    sub: input.sub,
    email: input.email,
    name: input.name,
    role: input.role,
    hotelId: input.hotelId ?? null,
    jti: randomUUID(),
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = base64url(JSON.stringify({ alg: ALGORITHM, typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  const signature = base64url(hmac(signingInput, secret));

  return { token: `${signingInput}.${signature}`, claims };
}

export function isTokenExpired(claims: AccessTokenClaims, now: number = Math.floor(Date.now() / 1000)): boolean {
  return claims.exp + CLOCK_SKEW_SECONDS <= now;
}

/** Returns the claims when the token is authentic and unexpired, otherwise null. */
export function verifyAccessToken(
  token: string | undefined | null,
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): AccessTokenClaims | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) return null;

  const expected = hmac(`${header}.${payload}`, secret);
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  let decodedHeader: { alg?: string };
  let claims: AccessTokenClaims;
  try {
    decodedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (decodedHeader.alg !== ALGORITHM) return null;
  if (typeof claims.sub !== "string" || !claims.sub) return null;
  if (typeof claims.jti !== "string" || !claims.jti) return null;
  if (typeof claims.exp !== "number" || typeof claims.iat !== "number") return null;
  if (claims.iat - CLOCK_SKEW_SECONDS > now) return null;
  if (isTokenExpired(claims, now)) return null;

  return claims;
}

/** Parses `7d`, `30m`, `12h`, `900` (seconds) style durations into seconds. */
export function parseDurationSeconds(value: string, fallbackSeconds: number): number {
  const match = /^(\d+)\s*([smhd]?)$/i.exec(value.trim());
  if (!match) return fallbackSeconds;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return fallbackSeconds;
  const unit = (match[2] || "s").toLowerCase();
  const multiplier = unit === "d" ? 86400 : unit === "h" ? 3600 : unit === "m" ? 60 : 1;
  return amount * multiplier;
}
