/**
 * Access-token session guard.
 *
 * JWTs are stateless, but a PMS still needs:
 *  - logout to end the token that was just used
 *  - password changes / role changes / deactivation to end *every* token a
 *    user currently holds
 *
 * The guard keeps two in-memory indexes (single API process):
 *  - revoked token ids, pruned once they would have expired anyway
 *  - a per-user "valid after" epoch; any token issued before it is rejected
 */

const revokedJti = new Map<string, number>(); // jti -> token expiry (epoch seconds)
const userEpoch = new Map<string, number>(); // userId -> earliest still-valid iat

let pruneTimer: NodeJS.Timeout | null = null;

function ensurePruning(): void {
  if (pruneTimer) return;
  pruneTimer = setInterval(() => prune(Math.floor(Date.now() / 1000)), 60_000);
  pruneTimer.unref?.();
}

export function revokeToken(jti: string, expiresAt: number, now: number = Math.floor(Date.now() / 1000)): void {
  if (!jti || expiresAt <= now) return;
  revokedJti.set(jti, expiresAt);
  ensurePruning();
}

/** Invalidates every outstanding token for a user (password/role change, deactivation). */
export function invalidateUserSessions(userId: string, now: number = Math.floor(Date.now() / 1000)): void {
  if (!userId) return;
  const current = userEpoch.get(userId) ?? 0;
  if (now > current) userEpoch.set(userId, now);
}

export function isSessionActive(
  userId: string,
  jti: string,
  issuedAt: number,
  _now: number = Math.floor(Date.now() / 1000),
): boolean {
  if (jti && revokedJti.has(jti)) return false;
  const epoch = userEpoch.get(userId);
  if (epoch !== undefined && issuedAt < epoch) return false;
  return true;
}

function prune(now: number): void {
  for (const [jti, expiry] of revokedJti) {
    if (expiry <= now) revokedJti.delete(jti);
  }
  if (revokedJti.size === 0 && pruneTimer) {
    clearInterval(pruneTimer);
    pruneTimer = null;
  }
}

/** Test helper - clears state between test cases. */
export function clearSessionGuard(): void {
  revokedJti.clear();
  userEpoch.clear();
}
