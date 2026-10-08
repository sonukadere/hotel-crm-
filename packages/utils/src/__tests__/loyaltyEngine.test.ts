import { describe, it, expect } from "vitest";
import {
  getDefaultLoyaltySettings,
  resolveTierForSpend,
  calculateTierProgress,
  calculatePointsEarned,
  calculateEligibleSpend,
  calculateRedemptionValue,
  calculateRedemptionCap,
  validateRedemptionRequest,
  buildReversalPlan,
  getTransactionPointDelta,
  buildLedgerIntegrity,
} from "../loyalty";
import type { LoyaltyProgramSettings, LoyaltyTransaction } from "@hotel/types";

describe("MODULE 10 — Hotel Loyalty Program Engine", () => {
  const defaultSettings: LoyaltyProgramSettings = getDefaultLoyaltySettings("hotel-test-1");

  describe("Tier Qualification & Configurable Thresholds", () => {
    it("assigns Bronze tier for new guests with zero or low spend", () => {
      const tier0 = resolveTierForSpend(defaultSettings, 0);
      const tier10k = resolveTierForSpend(defaultSettings, 10000);

      expect(tier0).toBe("Bronze");
      expect(tier10k).toBe("Bronze");
    });

    it("qualifies guest for Silver tier when lifetime spend meets Silver threshold", () => {
      // Default Silver threshold is ₹50,000
      const tier50k = resolveTierForSpend(defaultSettings, 50000);
      const tier100k = resolveTierForSpend(defaultSettings, 100000);

      expect(tier50k).toBe("Silver");
      expect(tier100k).toBe("Silver");
    });

    it("qualifies guest for Gold tier when lifetime spend meets Gold threshold", () => {
      // Default Gold threshold is ₹1,50,000
      const tier150k = resolveTierForSpend(defaultSettings, 150000);
      const tier250k = resolveTierForSpend(defaultSettings, 250000);

      expect(tier150k).toBe("Gold");
      expect(tier250k).toBe("Gold");
    });

    it("supports admin configurable tier thresholds", () => {
      // Custom admin configuration where Silver is ₹15,000 and Gold is ₹50,000
      const customSettings: LoyaltyProgramSettings = {
        ...defaultSettings,
        tiers: [
          {
            id: "t1",
            hotelId: "hotel-test-1",
            tier: "Bronze",
            thresholdLifetimeSpendInr: 0,
            pointsPerRupee: 0.05,
            redemptionValuePerPoint: 0.25,
            monthlyBonusPoints: 0,
            minPointsForRedemption: 100,
            maxRedemptionPercentPerFolio: 0.5,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "t2",
            hotelId: "hotel-test-1",
            tier: "Silver",
            thresholdLifetimeSpendInr: 15000,
            pointsPerRupee: 0.08,
            redemptionValuePerPoint: 0.35,
            monthlyBonusPoints: 100,
            minPointsForRedemption: 100,
            maxRedemptionPercentPerFolio: 0.5,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "t3",
            hotelId: "hotel-test-1",
            tier: "Gold",
            thresholdLifetimeSpendInr: 50000,
            pointsPerRupee: 0.12,
            redemptionValuePerPoint: 0.5,
            monthlyBonusPoints: 250,
            minPointsForRedemption: 100,
            maxRedemptionPercentPerFolio: 0.75,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      expect(resolveTierForSpend(customSettings, 12000)).toBe("Bronze");
      expect(resolveTierForSpend(customSettings, 20000)).toBe("Silver");
      expect(resolveTierForSpend(customSettings, 55000)).toBe("Gold");
    });

    it("calculates tier progress and distance to next tier correctly", () => {
      const progress = calculateTierProgress(defaultSettings, 15000);

      expect(progress.currentTier).toBe("Bronze");
      expect(progress.nextTier).toBe("Silver");
      expect(progress.spendToNextTierInr).toBe(35000); // ₹50,000 - ₹15,000 = ₹35,000
      expect(progress.progressPercent).toBe(30); // 15000 / 50000 = 30%
    });
  });

  describe("Points Earning from Eligible Spend", () => {
    it("earns points based on tier pointsPerRupee multiplier", () => {
      const spend = 10000; // ₹10,000 eligible spend

      // Default: Bronze (0.05 => 500 pts), Silver (0.08 => 800 pts), Gold (0.12 => 1200 pts)
      const bronzePts = calculatePointsEarned({ eligibleSpendInr: spend, settings: defaultSettings, tier: "Bronze" });
      const silverPts = calculatePointsEarned({ eligibleSpendInr: spend, settings: defaultSettings, tier: "Silver" });
      const goldPts = calculatePointsEarned({ eligibleSpendInr: spend, settings: defaultSettings, tier: "Gold" });

      expect(bronzePts).toBe(500);
      expect(silverPts).toBe(800);
      expect(goldPts).toBe(1200);
    });

    it("floors points to integer values so no fractional points exist", () => {
      const spend = 1255.5; // @ 0.05 = 62.775
      const points = calculatePointsEarned({ eligibleSpendInr: spend, settings: defaultSettings, tier: "Bronze" });

      expect(points).toBe(62);
      expect(Number.isInteger(points)).toBe(true);
    });

    it("filters eligible services spend correctly", () => {
      const items = [
        { itemType: "Room" as const, totalPrice: 8000, sacCode: "996311" },
        { itemType: "Restaurant" as const, totalPrice: 2500, sacCode: "996331" },
      ];

      const spendResult = calculateEligibleSpend(items, defaultSettings);
      expect(spendResult.eligibleSpendInr).toBe(10500); // 8000 + 2500 = 10500
      expect(spendResult.contributingItemTypes).toContain("Room");
      expect(spendResult.contributingItemTypes).toContain("Restaurant");
    });
  });

  describe("Points Redemption against Folio Charges", () => {
    it("calculates monetary redemption value according to tier rate", () => {
      const points = 2000;
      // Default: redemptionValuePerPoint is ₹0.50 across all default tiers
      const value = calculateRedemptionValue(points, defaultSettings, "Bronze");

      expect(value).toBe(1000); // 2000 * 0.50 = ₹1,000 credit
    });

    it("respects folio eligible balance cap during redemption", () => {
      const capResult = calculateRedemptionCap({
        requestedPoints: 10000,
        availablePoints: 10000,
        folioEligibleBalanceInr: 2000, // Folio only has ₹2,000 balance
        settings: defaultSettings,
        tier: "Gold",
      });

      // Cannot redeem more than folio cap
      expect(capResult.creditInr).toBeLessThanOrEqual(2000);
      expect(capResult.cappedPoints).toBeLessThanOrEqual(4000);
    });

    it("validates redemption request against minimum points threshold", () => {
      const validation = validateRedemptionRequest({
        requestedPoints: 200, // Below default 500 min
        availablePoints: 200,
        folioEligibleBalanceInr: 5000,
        settings: defaultSettings,
        tier: "Bronze",
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toMatch(/minimum/i);
    });
  });

  describe("Reversal Engine & Immutable Transaction Safeguards", () => {
    it("generates correct mirror Reversal plan for an Earn transaction", () => {
      const earnTx: Pick<LoyaltyTransaction, "id" | "type" | "points"> = {
        id: "tx-earn-1",
        type: "Earn",
        points: 500,
      };

      const plan = buildReversalPlan(earnTx, []);

      expect(plan.isReversible).toBe(true);
      expect(plan.reversalPoints).toBe(500);
      expect(plan.errors).toHaveLength(0);
    });

    it("generates correct mirror Reversal plan for a Redeem transaction", () => {
      const redeemTx: Pick<LoyaltyTransaction, "id" | "type" | "points"> = {
        id: "tx-redeem-1",
        type: "Redeem",
        points: -1000,
      };

      const plan = buildReversalPlan(redeemTx, []);

      expect(plan.isReversible).toBe(true);
      expect(plan.reversalPoints).toBe(1000); // 1000 points to reverse
      expect(plan.errors).toHaveLength(0);
    });

    it("prevents double-reversal of an already reversed transaction", () => {
      const tx: Pick<LoyaltyTransaction, "id" | "type" | "points"> = {
        id: "tx-orig",
        type: "Earn",
        points: 250,
      };

      const existingReversal = [{ id: "tx-rev-1" }];
      const plan = buildReversalPlan(tx, existingReversal);

      expect(plan.isReversible).toBe(false);
      expect(plan.errors[0]).toContain("already been reversed");
    });

    it("disallows reversing an existing Reversal transaction", () => {
      const revTx: Pick<LoyaltyTransaction, "id" | "type" | "points"> = {
        id: "tx-reversal-row",
        type: "Reversal",
        points: -500,
      };

      const plan = buildReversalPlan(revTx, []);

      expect(plan.isReversible).toBe(false);
      expect(plan.errors[0]).toContain("reversal cannot itself be reversed");
    });

    it("enforces signed delta conventions for all transaction types", () => {
      expect(getTransactionPointDelta("Earn", 300)).toBe(300);
      expect(getTransactionPointDelta("Redeem", 400)).toBe(-400);
      expect(getTransactionPointDelta("Expire", 200)).toBe(-200);
      expect(getTransactionPointDelta("Adjustment", 150)).toBe(150);
    });

    it("reconciles append-only ledger integrity: availablePoints === SUM(transactions.points)", () => {
      const rows = [
        { id: "1", type: "Earn" as const, points: 1000, createdAt: new Date("2026-01-01").toISOString() },
        { id: "2", type: "Earn" as const, points: 500, createdAt: new Date("2026-01-02").toISOString() },
        { id: "3", type: "Redeem" as const, points: -600, createdAt: new Date("2026-01-03").toISOString() },
        { id: "4", type: "Reversal" as const, points: 600, createdAt: new Date("2026-01-04").toISOString() },
        { id: "5", type: "Redeem" as const, points: -400, createdAt: new Date("2026-01-05").toISOString() },
      ];

      const integrity = buildLedgerIntegrity("acc-1", 1100, rows);

      expect(integrity.isBalanced).toBe(true);
      expect(integrity.recordedBalance).toBe(1100);
      expect(integrity.ledgerSum).toBe(1100);
      expect(integrity.drift).toBe(0);
    });
  });
});
