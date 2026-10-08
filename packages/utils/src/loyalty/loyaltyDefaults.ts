import { LOYALTY_CONFIG } from "@hotel/config";
import type {
  LoyaltyProgramSettings,
  LoyaltyTier,
  LoyaltyTierRule,
  FolioItemType,
} from "@hotel/types";

/**
 * MODULE 10 — LOYALTY PROGRAM
 * Default / normalisation helpers for admin-configurable loyalty settings.
 *
 * The DB rows (`LoyaltySetting` + `LoyaltyTierRule`) are the source of truth.
 * `getDefaultLoyaltySettings()` bootstraps a brand new property, and
 * `normalizeLoyaltySettings()` hardens whatever comes out of the database so
 * the engine never has to defend itself against bad admin input.
 */

/** Fixed tier list, ordered lowest → highest. Matches the PRD. */
export const LOYALTY_TIERS: LoyaltyTier[] = ["Bronze", "Silver", "Gold"];

const DEFAULT_ELIGIBLE_ITEM_TYPES: FolioItemType[] = [
  "Room",
  "Restaurant",
  "InRoomDining",
  "Food",
  "Spa",
  "Laundry",
  "Banquet",
];

/** Coerces anything into a finite non-negative number. */
export function toSafeNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

/** Coerces anything into a finite number strictly greater than zero. */
export function toPositiveNumber(value: unknown, fallback: number): number {
  const parsed = toSafeNumber(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

/**
 * Points are integers by definition — the ledger `points` column is an Int.
 * Every earn/redemption amount is floored here so a partial rupee never mints
 * a fractional point that could not later be stored.
 */
export function floorPoints(points: number): number {
  return Math.max(0, Math.floor(toSafeNumber(points, 0)));
}

/** Currency-safe round to 2 decimals (mirrors `roundCurrency` in formatters). */
export function roundLoyaltyCurrency(value: number): number {
  return Math.round((toSafeNumber(value, 0) + Number.EPSILON) * 100) / 100;
}

/** Rounds a rate to 4 decimals — the precision of `Decimal(7,4)` columns. */
export function roundLoyaltyRate(value: number): number {
  return Math.round((toSafeNumber(value, 0) + Number.EPSILON) * 10000) / 10000;
}

function defaultTierRule(tier: LoyaltyTier, hotelId?: string): LoyaltyTierRule {
  const seed = LOYALTY_CONFIG.TIERS[tier];
  const now = new Date().toISOString();
  return {
    id: `default-${tier}`,
    hotelId: hotelId ?? "",
    tier,
    thresholdLifetimeSpendInr: seed.minSpend,
    pointsPerRupee: seed.pointsPerRupee,
    redemptionValuePerPoint: seed.redemptionValuePerPoint,
    monthlyBonusPoints: 0,
    minPointsForRedemption: LOYALTY_CONFIG.MIN_POINTS_FOR_REDEMPTION,
    maxRedemptionPercentPerFolio: LOYALTY_CONFIG.MAX_REDEMPTION_PERCENT_PER_FOLIO,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** Seeds a complete, internally consistent program configuration. */
export function getDefaultLoyaltySettings(hotelId?: string): LoyaltyProgramSettings {
  return {
    hotelId,
    basePointsPerRupee: LOYALTY_CONFIG.BASE_POINTS_PER_RUPEE,
    baseRedemptionValuePerPoint: LOYALTY_CONFIG.BASE_REDEMPTION_VALUE_PER_POINT,
    minPointsForRedemption: LOYALTY_CONFIG.MIN_POINTS_FOR_REDEMPTION,
    maxRedemptionPercentPerFolio: LOYALTY_CONFIG.MAX_REDEMPTION_PERCENT_PER_FOLIO,
    isEarningEnabled: LOYALTY_CONFIG.EARNING_ENABLED,
    isRedemptionEnabled: LOYALTY_CONFIG.REDEMPTION_ENABLED,
    earnOnPaymentCapture: LOYALTY_CONFIG.EARN_ON_PAYMENT_CAPTURE,
    eligibleItemTypes: [...DEFAULT_ELIGIBLE_ITEM_TYPES],
    eligibleSacCodes: [],
    isExpiryEnabled: LOYALTY_CONFIG.EXPIRY_ENABLED,
    expiryMonths: LOYALTY_CONFIG.POINTS_EXPIRY_MONTHS,
    expiryGracePeriodMonths: LOYALTY_CONFIG.EXPIRY_GRACE_PERIOD_MONTHS,
    expiryBasis: LOYALTY_CONFIG.EXPIRY_BASIS,
    tiers: LOYALTY_TIERS.map((tier) => defaultTierRule(tier, hotelId)),
  };
}

/** Deduplicates + de-quotes a JSON-ish array of item types. */
export function normalizeItemTypeList(input: unknown): FolioItemType[] {
  const raw: string[] = Array.isArray(input)
    ? (input as string[])
    : typeof input === "string"
      ? safeParseStringArray(input)
      : [];

  const seen = new Set<string>();
  for (const itemType of raw) {
    const clean = String(itemType).trim();
    if (clean) seen.add(clean);
  }

  return Array.from(seen) as FolioItemType[];
}

/** Deduplicates + de-quotes a JSON-ish array of SAC codes. */
export function normalizeSacCodeList(input: unknown): string[] {
  const raw: string[] = Array.isArray(input)
    ? (input as string[])
    : typeof input === "string"
      ? safeParseStringArray(input)
      : [];

  const seen = new Set<string>();
  for (const code of raw) {
    const clean = String(code).trim();
    if (clean) seen.add(clean);
  }
  return Array.from(seen).sort();
}

/** JSON columns in this schema are stored as TEXT; tolerate both shapes. */
function safeParseStringArray(input: string): string[] {
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return input
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
}

/** Clamps a 0–1 ratio, tolerating admins who type `50` meaning 50%. */
export function normalizeRatio(value: unknown, fallback: number): number {
  const parsed = toSafeNumber(value, fallback);
  if (parsed > 1) return Math.min(1, parsed / 100);
  if (parsed < 0) return 0;
  return parsed;
}

/**
 * Rebuilds a valid `LoyaltyProgramSettings` from whatever the database returned,
 * filling gaps with defaults so a partially-seeded property still works.
 */
export function normalizeLoyaltySettings(
  input: Partial<LoyaltyProgramSettings> | null | undefined,
  hotelId?: string,
): LoyaltyProgramSettings {
  const fallback = getDefaultLoyaltySettings(hotelId);
  if (!input) return fallback;

  const tiers = (input.tiers && input.tiers.length > 0 ? input.tiers : fallback.tiers).map(
    (rule) => normalizeTierRule(rule, input, fallback),
  );

  // Guarantee a rule exists for all three PRD tiers, in ascending order.
  for (const tier of LOYALTY_TIERS) {
    if (!tiers.some((rule) => rule.tier === tier)) {
      tiers.push(defaultTierRule(tier, hotelId));
    }
  }

  const minPoints = Math.floor(
    toSafeNumber(input.minPointsForRedemption, fallback.minPointsForRedemption),
  );

  return {
    hotelId: input.hotelId ?? hotelId,
    basePointsPerRupee: roundLoyaltyRate(
      toPositiveNumber(input.basePointsPerRupee, fallback.basePointsPerRupee),
    ),
    baseRedemptionValuePerPoint: roundLoyaltyRate(
      toPositiveNumber(
        input.baseRedemptionValuePerPoint,
        fallback.baseRedemptionValuePerPoint,
      ),
    ),
    minPointsForRedemption: minPoints >= 0 ? minPoints : fallback.minPointsForRedemption,
    maxRedemptionPercentPerFolio: normalizeRatio(
      input.maxRedemptionPercentPerFolio,
      fallback.maxRedemptionPercentPerFolio,
    ),
    isEarningEnabled: input.isEarningEnabled ?? fallback.isEarningEnabled,
    isRedemptionEnabled: input.isRedemptionEnabled ?? fallback.isRedemptionEnabled,
    earnOnPaymentCapture: input.earnOnPaymentCapture ?? fallback.earnOnPaymentCapture,
    eligibleItemTypes:
      normalizeItemTypeList(input.eligibleItemTypes).length > 0
        ? normalizeItemTypeList(input.eligibleItemTypes)
        : fallback.eligibleItemTypes,
    eligibleSacCodes: normalizeSacCodeList(input.eligibleSacCodes ?? fallback.eligibleSacCodes),
    isExpiryEnabled: input.isExpiryEnabled ?? fallback.isExpiryEnabled,
    expiryMonths: Math.floor(
      Math.max(1, toSafeNumber(input.expiryMonths, fallback.expiryMonths)),
    ),
    expiryGracePeriodMonths: Math.floor(
      Math.max(0, toSafeNumber(input.expiryGracePeriodMonths, fallback.expiryGracePeriodMonths)),
    ),
    expiryBasis: input.expiryBasis === "CalendarYearEnd" ? "CalendarYearEnd" : "EarnTransactionDate",
    tiers: sortTierRules(tiers),
  };
}

function normalizeTierRule(
  rule: Partial<LoyaltyTierRule>,
  settings: Partial<LoyaltyProgramSettings> | null | undefined,
  fallback: LoyaltyProgramSettings,
): LoyaltyTierRule {
  const now = new Date().toISOString();
  const globalMaxPercent = normalizeRatio(
    settings?.maxRedemptionPercentPerFolio,
    fallback.maxRedemptionPercentPerFolio,
  );

  return {
    id: rule.id ?? "",
    hotelId: rule.hotelId ?? settings?.hotelId ?? "",
    tier: (LOYALTY_TIERS.includes(rule.tier as LoyaltyTier) ? rule.tier : "Bronze") as LoyaltyTier,
    thresholdLifetimeSpendInr: roundLoyaltyCurrency(
      Math.max(
        0,
        toSafeNumber(
          rule.thresholdLifetimeSpendInr,
          fallback.tiers.find((t) => t.tier === rule.tier)?.thresholdLifetimeSpendInr ?? 0,
        ),
      ),
    ),
    pointsPerRupee: roundLoyaltyRate(
      toPositiveNumber(rule.pointsPerRupee, fallback.basePointsPerRupee),
    ),
    redemptionValuePerPoint: roundLoyaltyRate(
      toPositiveNumber(rule.redemptionValuePerPoint, fallback.baseRedemptionValuePerPoint),
    ),
    monthlyBonusPoints: floorPoints(rule.monthlyBonusPoints ?? 0),
    minPointsForRedemption: Math.floor(
      Math.max(0, toSafeNumber(rule.minPointsForRedemption, fallback.minPointsForRedemption)),
    ),
    maxRedemptionPercentPerFolio: normalizeRatio(rule.maxRedemptionPercentPerFolio, globalMaxPercent),
    isActive: rule.isActive ?? true,
    createdAt: rule.createdAt ?? now,
    updatedAt: rule.updatedAt ?? now,
  };
}

/** Ascending by threshold — the order the tier engine walks the ladder. */
export function sortTierRules(rules: LoyaltyTierRule[]): LoyaltyTierRule[] {
  return [...rules].sort((a, b) => a.thresholdLifetimeSpendInr - b.thresholdLifetimeSpendInr);
}

/** A single default rule for a tier — the last-resort fallback. */
export function getDefaultTierRule(tier: LoyaltyTier, hotelId?: string): LoyaltyTierRule {
  return defaultTierRule(tier, hotelId);
}