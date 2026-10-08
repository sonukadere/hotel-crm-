import type { LoyaltyProgramSettings, LoyaltyTier } from "@hotel/types";
import {
  floorPoints,
  normalizeRatio,
  roundLoyaltyCurrency,
  roundLoyaltyRate,
  toSafeNumber,
} from "./loyaltyDefaults";
import { getTierRule } from "./loyaltyEarning";

/**
 * MODULE 10 — LOYALTY REDEMPTION ENGINE
 *
 * Redemption converts points into a folio credit. Two independent caps apply:
 *   1. the guest's wallet (available points), and
 *   2. the outstanding eligible folio balance (a single stay cannot be settled
 *      entirely in points — the hotel still needs some cash for the night audit).
 */

/** ₹ of folio credit a given number of points is worth at the guest's tier. */
export function calculateRedemptionValue(
  points: number,
  settings: LoyaltyProgramSettings,
  tier: LoyaltyTier = "Bronze",
): number {
  const rule = getTierRule(settings, tier);
  const value = roundLoyaltyRate(rule.redemptionValuePerPoint);
  return roundLoyaltyCurrency(floorPoints(points) * value);
}

/** ₹ value of the guest's whole wallet at the current tier rate. */
export function calculateRedeemableValue(
  availablePoints: number,
  settings: LoyaltyProgramSettings,
  tier: LoyaltyTier = "Bronze",
): number {
  return calculateRedemptionValue(availablePoints, settings, tier);
}

export type RedemptionCapReason =
  | "NoLimit"
  | "NoPoints"
  | "InsufficientPoints"
  | "BelowTierMinimum"
  | "FolioHasNoEligibleBalance"
  | "FolioBalanceCap";

export interface RedemptionCap {
  /** Largest number of points that may legally be redeemed right now. */
  maxPoints: number;
  /** The caller's request, clamped to `maxPoints`. */
  cappedPoints: number;
  /** ₹ credit that `cappedPoints` translates to. */
  creditInr: number;
  /** The binding constraint, for a precise front-desk error message. */
  cappedBy: RedemptionCapReason;
}

export interface CalculateRedemptionCapInput {
  requestedPoints: number;
  availablePoints: number;
  /** Outstanding balance on the folio, or the eligible portion of it. */
  folioEligibleBalanceInr: number;
  settings: LoyaltyProgramSettings;
  tier?: LoyaltyTier;
  /** Honour the global cap even when the tier defines its own (default true). */
  useGlobalCap?: boolean;
}

/**
 * Works out the maximum redeemable points, and where the cap came from, so the
 * API can return an actionable message instead of a generic failure.
 */
export function calculateRedemptionCap(input: CalculateRedemptionCapInput): RedemptionCap {
  const settings = input.settings;
  const tier = input.tier ?? "Bronze";
  const rule = getTierRule(settings, tier);

  const available = floorPoints(input.availablePoints);
  const requested = floorPoints(input.requestedPoints);
  const folioBalance = Math.max(0, roundLoyaltyCurrency(input.folioEligibleBalanceInr));

  const valuePerPoint = roundLoyaltyRate(rule.redemptionValuePerPoint);
  const useGlobalCap = input.useGlobalCap !== false;
  const ratio = useGlobalCap
    ? Math.min(
        normalizeRatio(input.settings.maxRedemptionPercentPerFolio, 1),
        normalizeRatio(rule.maxRedemptionPercentPerFolio, 1),
      )
    : normalizeRatio(rule.maxRedemptionPercentPerFolio, 1);

  // Cap 1: the guest's wallet.
  let maxPoints = available;
  let cappedBy: RedemptionCapReason = "NoLimit";

  // Cap 2: how many points the outstanding folio balance can absorb.
  if (folioBalance <= 0) {
    maxPoints = 0;
    cappedBy = "FolioHasNoEligibleBalance";
  } else {
    const pointsAffordableByFolio = Math.floor(folioBalance / valuePerPoint + 1e-9);
    const folioAllowedPoints = Math.floor(pointsAffordableByFolio * ratio + 1e-9);

    if (folioAllowedPoints < maxPoints) {
      maxPoints = folioAllowedPoints;
      cappedBy = "FolioBalanceCap";
    }
  }

  if (maxPoints === 0 && cappedBy === "NoLimit") {
    cappedBy = available === 0 ? "NoPoints" : "InsufficientPoints";
  }

  const cappedPoints = Math.min(requested, maxPoints);

  return {
    maxPoints,
    cappedPoints,
    creditInr: calculateRedemptionValue(cappedPoints, settings, tier),
    cappedBy,
  };
}

export interface ValidateRedemptionInput {
  requestedPoints: number;
  availablePoints: number;
  folioEligibleBalanceInr: number;
  settings: LoyaltyProgramSettings;
  tier?: LoyaltyTier;
}

/**
 * Pre-flight check for a redemption request. Returns the cap so the caller can
 * either post it or report precisely why it was refused.
 */
export function validateRedemptionRequest(input: ValidateRedemptionInput): {
  isValid: boolean;
  cap: RedemptionCap;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tier = input.tier ?? "Bronze";
  const rule = getTierRule(input.settings, tier);

  const requested = floorPoints(input.requestedPoints);
  const available = floorPoints(input.availablePoints);
  const cap = calculateRedemptionCap({
    requestedPoints: requested,
    availablePoints: available,
    folioEligibleBalanceInr: input.folioEligibleBalanceInr,
    settings: input.settings,
    tier,
  });

  if (!input.settings.isRedemptionEnabled) {
    errors.push("Loyalty redemption is currently disabled by the property");
    return { isValid: false, cap, errors, warnings };
  }

  if (requested <= 0) {
    errors.push("Redemption points must be a positive whole number");
  }

  const minPoints = Math.max(
    Math.floor(toSafeNumber(rule.minPointsForRedemption, 0)),
    Math.floor(toSafeNumber(input.settings.minPointsForRedemption, 0)),
  );

  if (requested < minPoints) {
    errors.push(
      `Minimum redemption at ${tier} tier is ${minPoints.toLocaleString("en-IN")} points; requested ${requested.toLocaleString("en-IN")}`,
    );
  }

  if (available <= 0) {
    errors.push("Guest has no available loyalty points");
  } else if (requested > available) {
    errors.push(`Insufficient loyalty points. Available: ${available.toLocaleString("en-IN")}`);
  }

  if (cap.cappedBy === "FolioHasNoEligibleBalance") {
    errors.push("Folio has no outstanding eligible balance to redeem points against");
  } else if (cap.cappedBy === "FolioBalanceCap" && requested > cap.maxPoints) {
    errors.push(
      `Redemption capped at ${cap.maxPoints.toLocaleString("en-IN")} points (₹${cap.creditInr.toFixed(2)}) by the ${Math.round(
        normalizeRatio(rule.maxRedemptionPercentPerFolio, 1) * 100,
      )}% per-folio redemption limit on the outstanding eligible balance`,
    );
  }

  if (cap.cappedPoints > 0 && cap.cappedPoints < requested) {
    warnings.push(`Requested amount was reduced to ${cap.cappedPoints.toLocaleString("en-IN")} points`);
  }

  return { isValid: errors.length === 0, cap, errors, warnings };
}

/** Splits a total charge into the portion points may be applied to. */
export function calculateEligibleRedemptionBase(
  items: Array<{ totalPrice: number; gstAmount?: number; isVoided?: boolean; itemType: string }>,
  settings: LoyaltyProgramSettings,
  paidByCashOrGatewayInr = 0,
): number {
  const eligibleTypes = new Set<string>(settings.eligibleItemTypes);

  const eligibleDebit = (items ?? [])
    .filter((item) => !item.isVoided && eligibleTypes.has(item.itemType))
    .reduce((sum, item) => sum + Math.max(0, toSafeNumber(item.totalPrice, 0)), 0);

  const taxableBase = roundLoyaltyCurrency(Math.max(0, eligibleDebit - Math.max(0, paidByCashOrGatewayInr)));

  return Math.max(0, taxableBase);
}