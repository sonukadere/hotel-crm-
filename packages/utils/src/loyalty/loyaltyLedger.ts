import type {
  LoyaltyLedgerIntegrity,
  LoyaltyProgramSettings,
  LoyaltyTier,
  LoyaltyTierProgress,
  LoyaltyTransaction,
  LoyaltyTransactionType,
} from "@hotel/types";
import {
  floorPoints,
  roundLoyaltyCurrency,
  roundLoyaltyRate,
  toSafeNumber,
} from "./loyaltyDefaults";
import { calculateRedemptionValue } from "./loyaltyRedemption";
import { calculateTierProgress, getTierRule } from "./loyaltyEarning";

/**
 * MODULE 10 — IMMUTABLE LOYALTY LEDGER
 *
 * Invariant enforced by this module and by `loyaltyService.postTransaction()`:
 *   `LoyaltyAccount.availablePoints === SUM(LoyaltyTransaction.points)`
 *
 * The balance column is a *cached projection* of the append-only ledger. It is
 * never written except alongside a new ledger row, so the two can always be
 * reconciled. `buildLedgerIntegrity()` performs that reconciliation on demand.
 */

/** Sign convention for each transaction type — credits vs debits the wallet. */
const POINTS_SIGN_BY_TYPE: Record<LoyaltyTransactionType, 1 | -1> = {
  Earn: 1,
  Adjustment: 1, // signed explicitly; positive Adjustment credits
  Reversal: -1, // signed explicitly; mirrors the original
  Redeem: -1,
  Expire: -1,
};

/** Which way a transaction type moves the wallet, for reporting. */
export function isCreditTransaction(type: LoyaltyTransactionType): boolean {
  return POINTS_SIGN_BY_TYPE[type] === 1;
}

/**
 * Returns the signed point delta to post for a new transaction.
 *
 * `Earn` and a positive `Adjustment` credit the wallet; `Redeem`, `Expire` and a
 * negative `Adjustment` debit it. A `Reversal` is a pure mirror of the row it
 * reverses, so redeeming 1,000 points (posted as -1000) reverses as +1000 and
 * an earn of 500 reverses as -500.
 */
export function getTransactionPointDelta(
  type: LoyaltyTransactionType,
  points: number,
  originalPoints?: number,
): number {
  const magnitude = floorPoints(Math.abs(toSafeNumber(points, 0)));

  if (type === "Reversal") {
    const fallback = toSafeNumber(points, 0);
    const originalPointsResolved = originalPoints === undefined ? fallback : toSafeNumber(originalPoints, fallback);
    const originalMagnitude = floorPoints(Math.abs(originalPointsResolved));
    return originalMagnitude > 0 ? -originalMagnitude : magnitude;
  }

  return POINTS_SIGN_BY_TYPE[type] * magnitude;
}

/** Rounds an ₹ amount for a ledger row that carries monetary impact. */
export function normalizeLedgerAmount(value: unknown): number {
  return roundLoyaltyCurrency(toSafeNumber(value, 0));
}

/**
 * The point delta for a reversal of `original`, plus the reason it is refused
 * when the original cannot be reversed. A row can only ever be reversed once —
 * the DB enforces this with a unique index on `reversalOfTransactionId`.
 */
export function buildReversalPlan(
  original: Pick<LoyaltyTransaction, "id" | "type" | "points">,
  existingReversals: Pick<LoyaltyTransaction, "id">[] = [],
): { isReversible: boolean; reversalPoints: number; errors: string[] } {
  const errors: string[] = [];
  const alreadyReversed = existingReversals.some((r) => r.id !== original.id);

  if (original.type === "Reversal") {
    errors.push("A reversal cannot itself be reversed; post an Adjustment instead");
  }
  if (original.points === 0) {
    errors.push("A zero-point transaction has no effect to reverse");
  }
  if (alreadyReversed) {
    errors.push("Transaction has already been reversed");
  }

  const reversalPoints = Math.abs(toSafeNumber(original.points, 0));

  return {
    isReversible: errors.length === 0,
    reversalPoints,
    errors,
  };
}

export interface LedgerEntry {
  id: string;
  type: LoyaltyTransactionType;
  points: number;
  balanceAfter?: number;
  createdAt: string;
}

/**
 * Replays the ledger oldest → newest and returns a running balance per row.
 * Used both to sanity-check writes and to render the account statement.
 */
export function buildLedgerBalance(entries: LedgerEntry[]): {
  runningBalance: Array<LedgerEntry & { computedBalance: number }>;
  ledgerSum: number;
  finalBalance: number;
} {
  let running = 0;
  const runningBalance = [...(entries ?? [])]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((entry) => {
      running += Math.floor(toSafeNumber(entry.points, 0));
      return { ...entry, computedBalance: running };
    });

  return { runningBalance, ledgerSum: running, finalBalance: running };
}

/**
 * Reconciles the cached `availablePoints` against the ledger sum.
 *
 * Returns a structured verdict rather than throwing, so the API can expose a
 * `GET /loyalty/accounts/:guestId/verify-ledger` health endpoint and the nightly
 * audit can log drift without failing the whole run.
 */
export function buildLedgerIntegrity(
  accountId: string,
  recordedBalance: number,
  entries: LedgerEntry[],
): LoyaltyLedgerIntegrity {
  const errors: string[] = [];
  const { ledgerSum, runningBalance } = buildLedgerBalance(entries);

  const recorded = Math.floor(toSafeNumber(recordedBalance, 0));
  const drift = recorded - ledgerSum;
  const isBalanced = drift === 0;

  if (!isBalanced) {
    errors.push(
      `Balance drift of ${drift} point(s): account shows ${recorded}, ledger sums to ${ledgerSum}. ` +
        `Every balance change must be backed by a LoyaltyTransaction row.`,
    );
  }

  if (recorded < 0) {
    errors.push(`Account balance is negative (${recorded}) which should be impossible`);
  }

  for (const entry of runningBalance) {
    if (entry.computedBalance < 0) {
      errors.push(
        `Transaction ${entry.id} (${entry.type}) drove the balance negative to ${entry.computedBalance}`,
      );
    }
    if (typeof entry.balanceAfter === "number" && entry.balanceAfter !== entry.computedBalance) {
      errors.push(
        `Transaction ${entry.id} recorded balanceAfter ${entry.balanceAfter} but replays to ${entry.computedBalance}`,
      );
    }
  }

  const last = runningBalance[runningBalance.length - 1];

  return {
    accountId,
    isBalanced: errors.length === 0,
    recordedBalance: recorded,
    ledgerSum,
    drift,
    transactionCount: runningBalance.length,
    lastTransactionId: last?.id,
    lastBalanceAfter: last?.computedBalance,
    errors,
  };
}

// -----------------------------------------------------------------------------
// EXPIRY
// -----------------------------------------------------------------------------

/** Adds whole months, clamping the day-of-month (31 Jan + 1 month → 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + Math.floor(months));
  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(day, lastDayOfTargetMonth));
  return result;
}

/** Next 31 March at 23:59:59 — the Indian financial-year expiry boundary. */
export function getNextFinancialYearEnd(date: Date): Date {
  const currentFyEnd = new Date(date.getFullYear(), 2, 31, 23, 59, 59, 999);
  if (date.getTime() <= currentFyEnd.getTime()) return currentFyEnd;
  return new Date(date.getFullYear() + 1, 2, 31, 23, 59, 59, 999);
}

/** Expiry date for a lot, honouring either configured basis. */
export function getExpiryDate(
  earnedAt: Date,
  settings: Pick<LoyaltyProgramSettings, "expiryBasis" | "expiryMonths">,
): Date {
  return settings.expiryBasis === "CalendarYearEnd"
    ? getNextFinancialYearEnd(earnedAt)
    : addMonths(earnedAt, Math.max(1, settings.expiryMonths));
}

export interface PointLot {
  transactionId: string;
  source: LoyaltyTransactionType;
  /** Signed points from the originating row. */
  points: number;
  /** Unsigned points this lot contributes to the wallet. */
  availablePoints: number;
  earnedAt: Date;
  expiresAt: Date;
  isExpired: boolean;
  isWithinGracePeriod: boolean;
}

/** The slice of program settings the expiry engine needs. */
export interface ProgramSettingsForExpiry {
  expiryBasis: "EarnTransactionDate" | "CalendarYearEnd";
  expiryMonths: number;
  expiryGracePeriodMonths: number;
  isExpiryEnabled: boolean;
}

/** Minimum ledger row the expiry engine considers as the origin of a lot. */
const LOT_SOURCE_TYPES: LoyaltyTransactionType[] = [
  "Earn",
  "Adjustment",
  "Redeem",
  "Reversal",
];

/**
 * Builds FIFO expiry lots from the ledger.
 *
 * Debits (`Redeem`, `Expire`, `Reversal` of an earn) consume the *oldest* lots
 * first, which is how points expire in practice: what you use up first is what
 * you earned first.
 */
export function buildExpiryLots(
  transactions: LoyaltyTransaction[],
  settings: ProgramSettingsForExpiry,
  asOf: Date = new Date(),
): PointLot[] {
  const ordered = [...(transactions ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const credits: PointLot[] = [];
  let totalCredits = 0;

  // Pass 1: accumulate positive lots.
  for (const txn of ordered) {
    const points = Math.floor(toSafeNumber(txn.points, 0));
    if (points > 0 && LOT_SOURCE_TYPES.includes(txn.type)) {
      const earnedAt = new Date(txn.createdAt);
      const expiresAt = txn.expiresAt ? new Date(txn.expiresAt) : getExpiryDate(earnedAt, settings);
      const graceEndsAt = addMonths(expiresAt, Math.max(0, settings.expiryGracePeriodMonths));

      credits.push({
        transactionId: txn.id,
        source: txn.type,
        points,
        availablePoints: points,
        earnedAt,
        expiresAt,
        isExpired: expiresAt.getTime() <= asOf.getTime(),
        isWithinGracePeriod:
          expiresAt.getTime() <= asOf.getTime() && asOf.getTime() <= graceEndsAt.getTime(),
      });
      totalCredits += points;
    }
  }

  // Pass 2: consume oldest lots first with every negative entry.
  for (const txn of ordered) {
    const points = Math.floor(toSafeNumber(txn.points, 0));
    if (points >= 0) continue;

    let remaining = Math.abs(points);
    for (const lot of credits) {
      if (remaining <= 0) break;
      if (lot.availablePoints <= 0) continue;
      const consumed = Math.min(lot.availablePoints, remaining);
      lot.availablePoints -= consumed;
      remaining -= consumed;
    }
  }

  return credits;
}

/** Points that have lapsed (past expiry + grace) and are still on the wallet. */
export function calculatePointsToExpire(
  transactions: LoyaltyTransaction[],
  settings: ProgramSettingsForExpiry,
  asOf: Date = new Date(),
): { pointsToExpire: number; lots: PointLot[] } {
  if (!settings.isExpiryEnabled) return { pointsToExpire: 0, lots: [] };

  const lots = buildExpiryLots(transactions, settings, asOf).filter(
    (lot) => lot.availablePoints > 0 && lot.isExpired && !lot.isWithinGracePeriod,
  );

  const pointsToExpire = lots.reduce((sum, lot) => sum + lot.availablePoints, 0);
  return { pointsToExpire, lots };
}

/** Expiry information for the guest-facing account summary. */
export function calculateExpirySummary(
  transactions: LoyaltyTransaction[],
  settings: ProgramSettingsForExpiry,
  asOf: Date = new Date(),
): { isExpiryEnabled: boolean; nextExpiryDate?: string; pointsExpiring: number } {
  if (!settings.isExpiryEnabled) {
    return { isExpiryEnabled: false, nextExpiryDate: undefined, pointsExpiring: 0 };
  }

  const lots = buildExpiryLots(transactions, settings, asOf).filter(
    (lot) => lot.availablePoints > 0 && !lot.isExpired,
  );

  if (lots.length === 0) {
    return { isExpiryEnabled: true, nextExpiryDate: undefined, pointsExpiring: 0 };
  }

  const upcoming = lots.reduce((earliest, lot) =>
    lot.expiresAt.getTime() < earliest.expiresAt.getTime() ? lot : earliest,
  );

  return {
    isExpiryEnabled: true,
    nextExpiryDate: upcoming.expiresAt.toISOString(),
    pointsExpiring: upcoming.availablePoints,
  };
}

// -----------------------------------------------------------------------------
// ACCOUNT SUMMARY
// -----------------------------------------------------------------------------

export interface LoyaltyAccountLike {
  availablePoints: number;
  lifetimePoints: number;
  redeemedPoints: number;
  lifetimeSpendInr: number;
  tier: LoyaltyTier;
}

/** Guest-facing roll-up combining wallet, tier progress, expiry and cash value. */
export function buildAccountSummary(
  account: LoyaltyAccountLike,
  transactions: LoyaltyTransaction[],
  settings: LoyaltyProgramSettings,
  asOf: Date = new Date(),
): {
  progress: LoyaltyTierProgress;
  expiry: { isExpiryEnabled: boolean; nextExpiryDate?: string; pointsExpiring: number; gracePeriodMonths: number };
  value: {
    pointsPerRupee: number;
    redemptionValuePerPoint: number;
    redeemableValueInr: number;
    minPointsForRedemption: number;
    maxRedemptionPercentPerFolio: number;
  };
} {
  const rule = getTierRule(settings, account.tier);
  const expiry = calculateExpirySummary(transactions, settings, asOf);

  return {
    progress: calculateTierProgress(settings, account.lifetimeSpendInr),
    expiry: {
      isExpiryEnabled: expiry.isExpiryEnabled,
      nextExpiryDate: expiry.nextExpiryDate,
      pointsExpiring: expiry.pointsExpiring,
      gracePeriodMonths: settings.expiryGracePeriodMonths,
    },
    value: {
      pointsPerRupee: roundLoyaltyRate(rule.pointsPerRupee),
      redemptionValuePerPoint: roundLoyaltyRate(rule.redemptionValuePerPoint),
      redeemableValueInr: calculateRedemptionValue(account.availablePoints, settings, account.tier),
      minPointsForRedemption: Math.max(
        floorPoints(rule.minPointsForRedemption),
        floorPoints(settings.minPointsForRedemption),
      ),
      maxRedemptionPercentPerFolio: Math.min(
        settings.maxRedemptionPercentPerFolio,
        rule.maxRedemptionPercentPerFolio,
      ),
    },
  };
}

/** Programme-level reporting: members, points in circulation, liability in ₹. */
export function calculateProgramLiability(
  accounts: LoyaltyAccountLike[],
  settings: LoyaltyProgramSettings,
): LoyaltyProgramLiability {
  const byTier: LoyaltyProgramLiability["byTier"] = {
    Bronze: { members: 0, availablePoints: 0, lifetimeSpendInr: 0 },
    Silver: { members: 0, availablePoints: 0, lifetimeSpendInr: 0 },
    Gold: { members: 0, availablePoints: 0, lifetimeSpendInr: 0 },
  };

  let totalAvailablePoints = 0;
  let totalOutstandingValueInr = 0;

  for (const account of accounts ?? []) {
    const bucket = byTier[account.tier] ?? byTier.Bronze;
    bucket.members += 1;
    bucket.availablePoints += floorPoints(account.availablePoints);
    bucket.lifetimeSpendInr = roundLoyaltyCurrency(
      bucket.lifetimeSpendInr + toSafeNumber(account.lifetimeSpendInr, 0),
    );

    totalAvailablePoints += floorPoints(account.availablePoints);
    totalOutstandingValueInr = roundLoyaltyCurrency(
      totalOutstandingValueInr +
        calculateRedemptionValue(account.availablePoints, settings, account.tier),
    );
  }

  return {
    memberCount: (accounts ?? []).length,
    totalAvailablePoints,
    totalOutstandingValueInr,
    byTier,
  };
}

/** Programme-level reporting: members, points in circulation, liability in ₹. */
export interface LoyaltyProgramLiability {
  memberCount: number;
  totalAvailablePoints: number;
  totalOutstandingValueInr: number;
  byTier: Record<LoyaltyTier, { members: number; availablePoints: number; lifetimeSpendInr: number }>;
}