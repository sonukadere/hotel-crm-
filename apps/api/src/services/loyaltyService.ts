import { prisma } from "../db/prisma";
import { LoyaltyTier } from "@hotel/types";
import { LOYALTY_CONFIG } from "@hotel/config";
import { recordAuditLog } from "./auditService";

export async function getOrCreateLoyaltyAccount(guestId: string) {
  let account = await prisma.loyaltyAccount.findUnique({
    where: { guestId },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  if (!account) {
    account = await prisma.loyaltyAccount.create({
      data: {
        guestId,
        tier: "Bronze",
        availablePoints: 0,
        lifetimePoints: 0,
        redeemedPoints: 0,
      },
      include: { transactions: true },
    });
  }

  return account;
}

export function determineTier(lifetimeSpendINR: number): LoyaltyTier {
  if (lifetimeSpendINR >= LOYALTY_CONFIG.TIERS.Gold.minSpend) return "Gold";
  if (lifetimeSpendINR >= LOYALTY_CONFIG.TIERS.Silver.minSpend) return "Silver";
  return "Bronze";
}

export async function earnLoyaltyPoints(params: {
  guestId: string;
  eligibleSpendINR: number;
  referenceFolioId?: string;
  userId?: string;
}) {
  return await prisma.$transaction(async (tx) => {
    let account = await tx.loyaltyAccount.findUnique({ where: { guestId: params.guestId } });
    if (!account) {
      account = await tx.loyaltyAccount.create({
        data: { guestId: params.guestId, tier: "Bronze" },
      });
    }

    const tierConfig = LOYALTY_CONFIG.TIERS[account.tier];
    const pointsEarned = Math.floor((params.eligibleSpendINR / 100) * tierConfig.pointsPer100Inr);

    if (pointsEarned <= 0) return account;

    // Create immutable transaction record
    await tx.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        type: "Earn",
        points: pointsEarned,
        referenceFolioId: params.referenceFolioId,
        notes: `Earned from eligible spend ₹${params.eligibleSpendINR} under ${account.tier} tier`,
      },
    });

    // Update account totals
    const updatedAccount = await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        availablePoints: { increment: pointsEarned },
        lifetimePoints: { increment: pointsEarned },
      },
    });

    await recordAuditLog({
      userId: params.userId,
      action: "LOYALTY_POINTS_EARNED",
      entity: "LoyaltyAccount",
      entityId: account.id,
      newValue: { pointsEarned, newBalance: updatedAccount.availablePoints },
    });

    return updatedAccount;
  });
}

export async function redeemLoyaltyPoints(params: {
  guestId: string;
  pointsToRedeem: number;
  folioId: string;
  userId?: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const account = await tx.loyaltyAccount.findUniqueOrThrow({
      where: { guestId: params.guestId },
    });

    if (account.availablePoints < params.pointsToRedeem) {
      throw new Error(`Insufficient loyalty points. Available: ${account.availablePoints}`);
    }

    const tierConfig = LOYALTY_CONFIG.TIERS[account.tier];
    const monetaryValueINR = params.pointsToRedeem * tierConfig.redemptionRateInr;

    // 1. Immutable transaction
    await tx.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        type: "Redeem",
        points: -params.pointsToRedeem,
        referenceFolioId: params.folioId,
        notes: `Redeemed ${params.pointsToRedeem} points for ₹${monetaryValueINR} folio credit`,
      },
    });

    // 2. Deduct points from account
    const updatedAccount = await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        availablePoints: { decrement: params.pointsToRedeem },
        redeemedPoints: { increment: params.pointsToRedeem },
      },
    });

    // 3. Post as credit to Folio
    const folio = await tx.folio.findUniqueOrThrow({ where: { id: params.folioId } });
    await tx.payment.create({
      data: {
        paymentNumber: `PAY-LOYALTY-${Date.now()}`,
        folioId: params.folioId,
        amount: monetaryValueINR as any,
        method: "Other",
        status: "Captured",
        transactionRef: `Loyalty Redemption (${params.pointsToRedeem} pts)`,
        notes: `Redeemed ${params.pointsToRedeem} pts against folio`,
      },
    });

    // Recompute folio balance
    const currentCredit = Number(folio.totalCredit) + monetaryValueINR;
    const currentDebit = Number(folio.totalDebit);
    const newBalance = currentDebit - currentCredit;

    await tx.folio.update({
      where: { id: params.folioId },
      data: {
        totalCredit: currentCredit as any,
        balanceDue: newBalance as any,
        status: newBalance <= 0.01 ? "Settled" : "Open",
      },
    });

    await recordAuditLog({
      hotelId: folio.hotelId,
      userId: params.userId,
      action: "LOYALTY_POINTS_REDEEMED",
      entity: "LoyaltyAccount",
      entityId: account.id,
      newValue: { pointsRedeemed: params.pointsToRedeem, creditINR: monetaryValueINR },
    });

    return {
      updatedAccount,
      monetaryValueINR,
    };
  });
}
