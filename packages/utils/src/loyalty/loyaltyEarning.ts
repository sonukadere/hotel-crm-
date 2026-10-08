import type {
  FolioItemType,
  LoyaltyProgramSettings,
  LoyaltyTier,
  LoyaltyTierProgress,
  LoyaltyTierRule,
} from "@hotel/types";
import {
  floorPoints,
  getDefaultTierRule,
  normalizeRatio,
  roundLoyaltyCurrency,
  roundLoyaltyRate,
  sortTierRules,
  toSafeNumber,
} from "./loyaltyDefaults";

/**
 * MODULE 10 — LOYALTY EARNING ENGINE
 *
 * Tiers are driven by *cumulative lifetime qualifying spend* (₹), not by points
 * held — a guest keeps their Silver/Gold status even after redeeming, which is
 * how real hotel programmes behave.
 */

/** Returns the tier rule for a tier, falling back to the cheapest configured rule. */
export function getTierRule(
  settings: LoyaltyProgramSettings,
  tier: LoyaltyTier,
): LoyaltyTierRule {
  const rules = sortTierRules(settings.tiers);
  const exact = rules.find((rule) => rule.tier === tier);
  if (exact) return exact;
  return rules[0] ?? getDefaultTierRule("Bronze", settings.hotelId);
}

/**
 * Resolves the tier a guest qualifies for at a given lifetime spend.
 * Bronze is the floor (threshold 0); the highest satisfied threshold wins.
 */
export function resolveTierForSpend(
  settings: LoyaltyProgramSettings,
  lifetimeSpendInr: number,
): LoyaltyTier {
  const spend = Math.max(0, toSafeNumber(lifetimeSpendInr, 0));
  const rules = sortTierRules(settings.tiers);

  let resolved: LoyaltyTier = "Bronze";
  let bestThreshold = -1;

  for (const rule of rules) {
    if (rule.thresholdLifetimeSpendInr <= spend && rule.thresholdLifetimeSpendInr > bestThreshold) {
      resolved = rule.tier;
      bestThreshold = rule.thresholdLifetimeSpendInr;
    }
  }

  // A guest with zero spend and no configured 0-threshold rule is still Bronze.
  return resolved;
}

/** Progress toward the next tier — drives the CRM "₹18,400 to Gold" nudge. */
export function calculateTierProgress(
  settings: LoyaltyProgramSettings,
  lifetimeSpendInr: number,
): LoyaltyTierProgress {
  const spend = Math.max(0, toSafeNumber(lifetimeSpendInr, 0));
  const rules = sortTierRules(settings.tiers);
  const currentTier = resolveTierForSpend(settings, spend);

  const currentRule = rules.find((rule) => rule.tier === currentTier) ?? rules[0];
  const nextRule = rules.find((rule) => rule.thresholdLifetimeSpendInr > spend);

  const currentThreshold = currentRule?.thresholdLifetimeSpendInr ?? 0;

  if (!nextRule) {
    return {
      currentTier,
      nextTier: undefined,
      currentTierThresholdInr: currentThreshold,
      nextTierThresholdInr: currentThreshold,
      lifetimeSpendInr: roundLoyaltyCurrency(spend),
      spendToNextTierInr: 0,
      progressPercent: 100,
    };
  }

  const bandWidth = nextRule.thresholdLifetimeSpendInr - currentThreshold;
  const intoBand = spend - currentThreshold;

  return {
    currentTier,
    nextTier: nextRule.tier,
    currentTierThresholdInr: roundLoyaltyCurrency(currentThreshold),
    nextTierThresholdInr: roundLoyaltyCurrency(nextRule.thresholdLifetimeSpendInr),
    lifetimeSpendInr: roundLoyaltyCurrency(spend),
    spendToNextTierInr: roundLoyaltyCurrency(
      Math.max(0, nextRule.thresholdLifetimeSpendInr - spend),
    ),
    progressPercent:
      bandWidth <= 0 ? 100 : Math.min(100, Math.max(0, Math.round((intoBand / bandWidth) * 100))),
  };
}

export interface CalculatePointsEarnedInput {
  /** Eligible INR spend for this transaction (post-discount, incl. GST as posted). */
  eligibleSpendInr: number;
  settings: LoyaltyProgramSettings;
  /** Tier the points are earned AT (defaults to the tier for prior spend). */
  tier?: LoyaltyTier;
  /** Lifetime qualifying spend *before* this transaction, for tier resolution. */
  lifetimeSpendInr?: number;
  /** Add the tier's courtesy bonus points on top of the base earn. */
  includeTierBonus?: boolean;
}

/**
 * Converts eligible INR spend into loyalty points at the applicable tier rate.
 *
 * Points are always floored to a whole number — the ledger `points` column is an
 * Int, so a fractional point would be unroutable. Spend below the floor of a
 * single point earns nothing (e.g. ₹19 at 0.05/₹ would be 0.95 points).
 */
export function calculatePointsEarned(input: CalculatePointsEarnedInput): number {
  const { settings } = input;
  if (!settings.isEarningEnabled) return 0;

  const spend = Math.max(0, toSafeNumber(input.eligibleSpendInr, 0));
  if (spend <= 0) return 0;

  const tier =
    input.tier ??
    resolveTierForSpend(settings, toSafeNumber(input.lifetimeSpendInr, 0));
  const rule = getTierRule(settings, tier);

  if (!rule.isActive) return 0;

  const rate = roundLoyaltyRate(rule.pointsPerRupee);
  const basePoints = Math.floor(spend * rate + 1e-9);
  const bonusPoints = input.includeTierBonus ? floorPoints(rule.monthlyBonusPoints) : 0;

  return floorPoints(basePoints + bonusPoints);
}

/** A folio line as far as the earning engine is concerned. */
export interface LoyaltyEligibleLineItem {
  itemType: FolioItemType;
  totalPrice?: number;
  gstAmount?: number;
  sacCode?: string;
  isVoided?: boolean;
}

export interface EligibleSpendResult {
  /** Sum of eligible line totals (excluding GST, which is never rewarded twice). */
  eligibleSpendInr: number;
  /** Sum of ineligible line totals, for the front-desk explanation. */
  ineligibleSpendInr: number;
  /** Item types that actually contributed eligible spend. */
  contributingItemTypes: FolioItemType[];
  /** Per-type eligible spend, for the audit trail. */
  breakdown: Array<{
    itemType: FolioItemType;
    amountInr: number;
    isEligible: boolean;
    reason: string;
  }>;
}

/**
 * Splits folio lines into eligible / ineligible spend using the admin's
 * "Eligible services" list.
 *
 * GST is deliberately excluded from the earnable base: GST is a statutory
 * pass-through to the government, not hotel revenue, so rewarding it would
 * inflate the liability without any real benefit.
 */
export function calculateEligibleSpend(
  items: LoyaltyEligibleLineItem[],
  settings: LoyaltyProgramSettings,
): EligibleSpendResult {
  const eligibleTypes = new Set<string>(settings.eligibleItemTypes);
  const sacAllowlist = new Set<string>(settings.eligibleSacCodes);

  let eligibleSpendInr = 0;
  let ineligibleSpendInr = 0;
  const contributing = new Set<FolioItemType>();
  const breakdown: EligibleSpendResult["breakdown"] = [];

  for (const item of items ?? []) {
    const amount = Math.max(0, toSafeNumber(item.totalPrice, 0));
    const sacAllowed = sacAllowlist.size === 0 || sacAllowlist.has(item.sacCode ?? "");
    const typeAllowed = eligibleTypes.has(item.itemType);

    let isEligible: boolean;
    let reason: string;

    if (item.isVoided) {
      isEligible = false;
      reason = "Voided folio line does not earn points";
    } else if (!typeAllowed) {
      isEligible = false;
      reason = `"${item.itemType}" is not an eligible service for loyalty earning`;
    } else if (!sacAllowed) {
      isEligible = false;
      reason = `SAC code ${item.sacCode ?? "unknown"} is excluded by admin settings`;
    } else {
      isEligible = true;
      reason = "Eligible service";
    }

    if (isEligible) {
      eligibleSpendInr += amount;
      contributing.add(item.itemType);
    } else {
      ineligibleSpendInr += amount;
    }

    breakdown.push({ itemType: item.itemType, amountInr: roundLoyaltyCurrency(amount), isEligible, reason });
  }

  return {
    eligibleSpendInr: roundLoyaltyCurrency(eligibleSpendInr),
    ineligibleSpendInr: roundLoyaltyCurrency(ineligibleSpendInr),
    contributingItemTypes: Array.from(contributing),
    breakdown,
  };
}

/**
 * Admin-side validation of a loyalty settings payload. Mirrors the
 * `validateCashCompliance` shape used elsewhere in this codebase: it returns a
 * result object rather than throwing so the CRM can render field-level errors.
 */
export function validateLoyaltyProgramSettings(
  settings: Partial<LoyaltyProgramSettings>,
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (toSafeNumber(settings.basePointsPerRupee, 0) <= 0) {
    errors.push("Base points per rupee must be greater than 0");
  }
  if (toSafeNumber(settings.baseRedemptionValuePerPoint, 0) <= 0) {
    errors.push("Base redemption value per point must be greater than 0");
  }
  if (Math.floor(toSafeNumber(settings.minPointsForRedemption, -1)) < 0) {
    errors.push("Minimum points for redemption cannot be negative");
  }

  const maxPercent = normalizeRatio(settings.maxRedemptionPercentPerFolio, 0);
  if (maxPercent <= 0 || maxPercent > 1) {
    errors.push("Max redemption percent per folio must be between 0 and 1 (e.g. 0.5 for 50%)");
  }

  if (!Array.isArray(settings.eligibleItemTypes) || settings.eligibleItemTypes.length === 0) {
    errors.push("At least one eligible service must be configured, otherwise no points can ever be earned");
  }

  if (Math.floor(toSafeNumber(settings.expiryMonths, 0)) <= 0) {
    errors.push("Expiry months must be greater than 0");
  }
  if (Math.floor(toSafeNumber(settings.expiryGracePeriodMonths, -1)) < 0) {
    errors.push("Expiry grace period months cannot be negative");
  }
  if (settings.expiryBasis && settings.expiryBasis !== "EarnTransactionDate" && settings.expiryBasis !== "CalendarYearEnd") {
    errors.push("Expiry basis must be either EarnTransactionDate or CalendarYearEnd");
  }

  const tiers = settings.tiers ?? [];
  if (tiers.length === 0) {
    errors.push("All three tiers (Bronze, Silver, Gold) must be configured");
  }

  const seenTiers = new Set<string>();
  const seenThresholds = new Set<number>();
  for (const rule of tiers) {
    if (seenTiers.has(rule.tier)) {
      errors.push(`Duplicate tier rule for ${rule.tier}`);
    }
    seenTiers.add(rule.tier);

    if (toSafeNumber(rule.thresholdLifetimeSpendInr, -1) < 0) {
      errors.push(`${rule.tier} tier threshold cannot be negative`);
    }
    if (toSafeNumber(rule.pointsPerRupee, 0) <= 0) {
      errors.push(`${rule.tier} tier points per rupee must be greater than 0`);
    }
    if (toSafeNumber(rule.redemptionValuePerPoint, 0) <= 0) {
      errors.push(`${rule.tier} tier redemption value per point must be greater than 0`);
    }
    if (toSafeNumber(rule.maxRedemptionPercentPerFolio, 0) <= 0) {
      errors.push(`${rule.tier} tier max redemption percent per folio must be greater than 0`);
    }

    const threshold = toSafeNumber(rule.thresholdLifetimeSpendInr, 0);
    if (seenThresholds.has(threshold)) {
      errors.push(
        `Tiers ${rule.tier} and another tier share the same threshold of ₹${threshold}; thresholds must be unique`,
      );
    }
    seenThresholds.add(threshold);
  }

  for (const required of ["Bronze", "Silver", "Gold"]) {
    if (!seenTiers.has(required)) {
      errors.push(`Missing tier rule for ${required}`);
    }
  }

  // Bronze must be the entry point or the ladder has no floor.
  const bronze = tiers.find((rule) => rule.tier === "Bronze");
  if (bronze && toSafeNumber(bronze.thresholdLifetimeSpendInr, 0) > 0) {
    warnings.push("Bronze threshold is above ₹0, so brand-new guests would have no starting tier");
  }

  const sorted = sortTierRules(tiers);
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (!previous || !current) continue;
    if (current.redemptionValuePerPoint < previous.redemptionValuePerPoint) {
      warnings.push(
        `${current.tier} redeems at a lower ₹ value per point than ${previous.tier}; higher tiers normally redeem richer`,
      );
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}