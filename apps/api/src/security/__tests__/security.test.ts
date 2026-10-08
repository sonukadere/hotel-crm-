/**
 * Module 14 - Security & Audit System unit tests.
 *
 * Runs on Node's built-in test runner (no DB, no network): only the security
 * modules are under test. Run with `pnpm --filter @hotel/api test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  isPasswordHashed,
  collectPasswordIssues,
  PasswordPolicyError,
} from "../passwords";
import {
  signAccessToken,
  verifyAccessToken,
  parseDurationSeconds,
} from "../jwt";
import {
  can,
  canAll,
  isUserRole,
  permissionsFor,
} from "../permissions";
import {
  revokeToken,
  invalidateUserSessions,
  isSessionActive,
  clearSessionGuard,
} from "../sessions";
import {
  redactSensitive,
  maskIdentityValue,
  redactLogMessage,
} from "../redaction";
import {
  sanitizeForClient,
  isMaskedIdentityValue,
} from "../sanitize";

const SECRET = "test-secret-that-is-at-least-32-characters-long!";

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

test("hashPassword produces a comparably scrypt hash that verifies", () => {
  const hash = hashPassword("Hotel@2026Secure!");
  assert.equal(isPasswordHashed(hash), true);
  assert.equal(hash.startsWith("scrypt$"), true);
  assert.equal(hash.length > 60, true);
  assert.equal(verifyPassword("Hotel@2026Secure!", hash), true);
  assert.equal(verifyPassword("Hotel@2026Secure?x", hash), false);
});

test("hashPassword enforces the password policy", () => {
  assert.throws(() => hashPassword("short"), PasswordPolicyError);
  assert.throws(() => hashPassword("alllowercase1234"), PasswordPolicyError);
  assert.throws(() => hashPassword("password"), PasswordPolicyError);
  assert.equal(collectPasswordIssues("IHotel@2026").length, 0);
});

test("legacy / missing hashes fail closed without throwing", () => {
  assert.equal(verifyPassword("anything", null), false);
  assert.equal(verifyPassword("anything", "$argon2id$v=19$m=65536,t=3,p=4$old$sample"), false);
  assert.equal(verifyPassword("anything", "not-a-hash"), false);
});

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------

test("JWT signs and verifies with claim round-trip", () => {
  const { token, claims } = signAccessToken(
    { sub: "u1", email: "a@b.in", name: "A", role: "FrontDesk", hotelId: "h1" },
    SECRET,
    3600,
    1_700_000_000,
  );
  assert.equal(typeof token, "string");
  assert.equal(token.split(".").length, 3);
  const verified = verifyAccessToken(token, SECRET, 1_700_000_000);
  assert.ok(verified);
  assert.equal(verified.sub, "u1");
  assert.equal(verified.role, "FrontDesk");
  assert.equal(verified.jti, claims.jti);
});

test("JWT rejects tampering, wrong secret and expiry", () => {
  const { token } = signAccessToken(
    { sub: "u1", email: "a@b.in", name: "A", role: "Admin" },
    SECRET,
    3600,
    1_700_000_000,
  );
  const [h, p, s] = token.split(".");
  const tampered = `${h}.${Buffer.from(p, "base64url").toString().replace("Admin", "SuperAdmin")}.${s}`;
  assert.equal(verifyAccessToken(tampered, SECRET, 1_700_000_000), null);
  assert.equal(verifyAccessToken(token, "different-secret-that-is-long-enough-12345", 1_700_000_000), null);
  assert.equal(verifyAccessToken(token, SECRET, 1_700_000_000 + 3700), null); // expired
});

test("parseDurationSeconds parses 7d, 30m, 12h, bare seconds and junk", () => {
  assert.equal(parseDurationSeconds("7d", 0), 7 * 86400);
  assert.equal(parseDurationSeconds("30m", 0), 1800);
  assert.equal(parseDurationSeconds("12h", 0), 43200);
  assert.equal(parseDurationSeconds("900", 0), 900);
  assert.equal(parseDurationSeconds("nonsense", 123), 123);
});

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------

test("role permission matrix grants the expected core permissions", () => {
  assert.equal(can("SuperAdmin", "user:manage"), true);
  assert.equal(can("Admin", "user:manage"), false); // only SuperAdmin
  assert.equal(can("Admin", "night-audit:run"), true);
  assert.equal(can("Manager", "payment:refund"), true);
  assert.equal(can("Manager", "settings:write"), true);
  assert.equal(can("FrontDesk", "reservation:checkin"), true);
  assert.equal(can("FrontDesk", "payment:refund"), false);
  assert.equal(can("FrontDesk", "night-audit:run"), false);
  assert.equal(can("Housekeeping", "room:status"), true);
  assert.equal(can("Housekeeping", "reservation:read"), false);
  assert.equal(can("Accountant", "invoice:generate"), true);
  assert.equal(can("Accountant", "payment:refund"), true);
  assert.equal(canAll("Manager", ["reservation:write", "invoice:correct"]), true);
  assert.equal(canAll("FrontDesk", ["reservation:read", "gst:manage"]), false);
  assert.equal(isUserRole("Manager"), true);
  assert.equal(isUserRole("CEO"), false);
  assert.equal(permissionsFor("CEO").length, 0);
});

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

test("revocation and per-user epochs invalidate sessions", () => {
  clearSessionGuard();
  const future = Math.floor(Date.now() / 1000) + 3600;
  assert.equal(isSessionActive("u1", "j1", 100), true);
  revokeToken("j1", future);
  assert.equal(isSessionActive("u1", "j1", 100), false);
  invalidateUserSessions("u1", 5000);
  assert.equal(isSessionActive("u1", "j2", 4999), false);
  assert.equal(isSessionActive("u1", "j2", 5000), true);
});

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

test("redactSensitive masks identity numbers and secrets", () => {
  const out = redactSensitive({
    fullName: "Ramesh",
    idNumber: "123456789012",
    password: "hunter2",
    razorpaySignature: "sig_abc",
    apiKey: "rzp_test_secret",
    nested: { pan: "ABCDE1234F", cardNumber: "4111111111111111" },
  });
  assert.equal(out.razorpaySignature, "[REDACTED]");
  assert.equal(out.apiKey, "[REDACTED]");
  assert.equal(out.password, "[REDACTED]");
  assert.notEqual(out.idNumber, "123456789012");
  assert.equal(out.idNumber, "XXXX-XXXX-9012");
  assert.equal(out.nested.pan, "ABXXXX234F");
  assert.equal(out.nested.cardNumber, "************1111");
});

test("maskIdentityValue formats Aadhaar and PAN", () => {
  assert.equal(maskIdentityValue("1234 5678 9012"), "XXXX-XXXX-9012");
  assert.equal(maskIdentityValue("ABCDE1234F"), "ABXXXX234F");
});

test("redactLogMessage strips passwords, bearer tokens and razorpay keys", () => {
  const line = 'login password="secret123" or password=xyz bearer AbCd.EfGh.IjKl rzp_test_abc123';
  const redacted = redactLogMessage(line);
  assert.equal(redacted.includes("secret123"), false);
  assert.equal(redacted.includes("AbCd.EfGh.IjKl"), false);
  assert.equal(redacted.includes("rzp_test_abc123"), false);
  assert.equal(redacted.includes("[REDACTED]"), true);
});

// ---------------------------------------------------------------------------
// Output sanitisation
// ---------------------------------------------------------------------------

test("sanitizeForClient masks idNumber and drops payment secrets", () => {
  const out = sanitizeForClient({
    booking: {
      primaryGuest: { identities: [{ identityType: "Aadhaar", idNumber: "123456789012", maskedIdNumber: null }] },
      folio: { payments: [{ amount: 100, razorpaySignature: "sig_abc123" }] },
    },
    user: { password: "hunter2", email: "a@b.in" },
  });
  const identity = (out as any).booking.primaryGuest.identities[0];
  assert.equal(identity.idNumber, "XXXX-XXXX-9012");
  assert.equal("razorpaySignature" in (out as any).booking.folio.payments[0], false);
  assert.equal("password" in (out as any).user, false);
  assert.equal((out as any).user.email, "a@b.in");
});

test("unrelated response data passes through untouched", () => {
  const out = sanitizeForClient({ data: { units: 3, status: "occupied" } });
  assert.deepEqual(out, { data: { units: 3, status: "occupied" } });
});

test("isMaskedIdentityValue distinguishes raw from round-tripped values", () => {
  assert.equal(isMaskedIdentityValue("123456789012"), false); // raw Aadhaar
  assert.equal(isMaskedIdentityValue("ABCDE1234F"), false); // raw PAN
  assert.equal(isMaskedIdentityValue("XXXX-XXXX-9012"), true);
  assert.equal(isMaskedIdentityValue("ABXXXX234F"), true);
  assert.equal(isMaskedIdentityValue("****5678"), true);
  assert.equal(isMaskedIdentityValue(null), false);
  assert.equal(isMaskedIdentityValue(""), false);
});