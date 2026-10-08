import { prisma } from "../db/prisma";
import type { LoyaltyTier } from "@hotel/types";
import {
  calculatePointsEarned,
  resolveTierForSpend,
  calculateTierProgress,
  calculateRedemptionValue,
  calculateRedemptionCap,
  buildReversalPlan,
  roundLoyaltyCurrency,
} from "@hotel/utils";
import { recordAuditLog } from "./auditService";
import { getLoyaltySettings, getDefaultHotelId } from "./loyaltySettingsService";
import { recalculateFolio } from "./folioService";

export interface LoyaltyServiceError extends Error {
  statusCode?: number;
  errors?: string[];
}

function createLoyaltyError(
  message: string,
  errors: string[] = [message],
  status = 400,
): LoyaltyServiceError {
  const err = new Error(message) as LoyaltyServiceError;
  err.statusCode = status;
  err.errors = errors;
  return err;
}

/**
 * 1. Get or Create Loyalty Account with Progress & Expiry Info
 */
export async function getOrCreateLoyaltyAccount(guestId: string, hotelId?: string) {
  const resolvedHotelId = hotelId ?? (await getDefaultHotelId());
  const { settings } = await getLoyaltySettings(resolvedHotelId);

  let account = await prisma.loyaltyAccount.findUnique({
    where: { guestId },
    include: {
      guest: true,
      transactions: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!account) {
    account = await prisma.loyaltyAccount.create({
      data: {
        guestId,
        hotelId: resolvedHotelId,
        tier: "Bronze",
        availablePoints: 0,
        lifetimePoints: 0,
        redeemedPoints: 0,
        expiredPoints: 0,
        lifetimeSpendInr: 0 as any,
      },
      include: {
        guest: true,
        transactions: true,
      },
    });
  }

  const lifetimeSpend = Number(account.lifetimeSpendInr || 0);
  const tierProgress = calculateTierProgress(settings, lifetimeSpend);

  return {
    ...account,
    lifetimeSpendInr: lifetimeSpend,
    tierProgress,
  };
}

/**
 * 2. Earn Loyalty Points from Eligible Spend
 * Tier thresholds and points per rupee multipliers loaded from admin settings.
 */
export async function earnLoyaltyPoints(params: {
  guestId: string;
  eligibleSpendINR: number;
  referenceFolioId?: string;
  referencePaymentId?: string;
  description?: string;
  userId?: string;
  hotelId?: string;
}) {
  const resolvedHotelId = params.hotelId ?? (await getDefaultHotelId());
  const { settings } = await getLoyaltySettings(resolvedHotelId);

  if (!settings.isEarningEnabled) {
    throw createLoyaltyError("Loyalty points earning is currently disabled by admin policy.");
  }

  const spendINR = roundLoyaltyCurrency(Number(params.eligibleSpendINR) || 0);
  if (spendINR <= 0) {
    throw createLoyaltyError("Eligible spend amount must be greater than zero.");
  }

  return await prisma.$transaction(async (tx) => {
    let account = await tx.loyaltyAccount.findUnique({ where: { guestId: params.guestId } });
    if (!account) {
      account = await tx.loyaltyAccount.create({
        data: { guestId: params.guestId, hotelId: resolvedHotelId, tier: "Bronze" },
      });
    }

    // 1. Calculate points earned under guest's current tier
    const pointsEarned = calculatePointsEarned({
      eligibleSpendInr: spendINR,
      settings,
      tier: account.tier as LoyaltyTier,
    });

    if (pointsEarned <= 0) {
      return account;
    }

    const currentBalance = account.availablePoints;
    const newBalance = currentBalance + pointsEarned;
    const currentLifetimePoints = account.lifetimePoints;
    const newLifetimePoints = currentLifetimePoints + pointsEarned;

    const currentLifetimeSpend = Number(account.lifetimeSpendInr || 0);
    const newLifetimeSpend = roundLoyaltyCurrency(currentLifetimeSpend + spendINR);

    // 2. Resolve any tier upgrade based on new cumulative spend
    const resolvedTier = resolveTierForSpend(settings, newLifetimeSpend);
    const tierChanged = resolvedTier !== account.tier;

    // 3. Compute expiry date if expiry is enabled
    const expiresAt = settings.isExpiryEnabled
      ? new Date(Date.now() + settings.expiryMonths * 30 * 24 * 60 * 60 * 1000)
      : undefined;

    // 4. Create immutable LoyaltyTransaction record
    const transaction = await tx.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        hotelId: resolvedHotelId,
        type: "Earn",
        points: pointsEarned,
        balanceAfter: newBalance,
        referenceFolioId: params.referenceFolioId,
        referencePaymentId: params.referencePaymentId,
        eligibleSpendInr: spendINR as any,
        tier: account.tier as LoyaltyTier,
        description: params.description || `Points earned from ₹${spendINR.toLocaleString("en-IN")} spend`,
        expiresAt,
        createdByUserId: params.userId,
      },
    });

    // 5. Update account projection
    const updatedAccount = await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        availablePoints: newBalance,
        lifetimePoints: newLifetimePoints,
        lifetimeSpendInr: newLifetimeSpend as any,
        tier: resolvedTier as any,
        tierChangedAt: tierChanged ? new Date() : undefined,
        lastEarnedAt: new Date(),
        expiresAt: expiresAt ?? account.expiresAt,
      },
    });

    await recordAuditLog(
      {
        hotelId: resolvedHotelId,
        userId: params.userId,
        action: "LOYALTY_POINTS_EARNED",
        entity: "LoyaltyAccount",
        entityId: account.id,
        newValue: {
          pointsEarned,
          newBalance,
          eligibleSpendINR: spendINR,
          transactionId: transaction.id,
          tier: resolvedTier,
        },
      },
      tx,
    );

    return {
      account: updatedAccount,
      transaction,
      pointsEarned,
    };
  });
}

/**
 * 3. Redeem Loyalty Points against Eligible Folio Charges
 * Folio Integration: Creates Folio Payment Credit + Immutable LoyaltyTransaction
 */
export async function redeemLoyaltyPoints(params: {
  guestId: string;
  pointsToRedeem: number;
  folioId: string;
  userId?: string;
  hotelId?: string;
}) {
  const resolvedHotelId = params.hotelId ?? (await getDefaultHotelId());
  const { settings } = await getLoyaltySettings(resolvedHotelId);

  if (!settings.isRedemptionEnabled) {
    throw createLoyaltyError("Loyalty points redemption is currently disabled by admin policy.");
  }

  const points = Math.floor(Number(params.pointsToRedeem) || 0);
  if (points <= 0) {
    throw createLoyaltyError("Points to redeem must be greater than zero.");
  }

  return await prisma.$transaction(async (tx) => {
    const account = await tx.loyaltyAccount.findUniqueOrThrow({
      where: { guestId: params.guestId },
    });

    if (account.availablePoints < points) {
      throw createLoyaltyError(
        `Insufficient points. Available: ${account.availablePoints}, Requested: ${points}`,
      );
    }

    const folio = await tx.folio.findUniqueOrThrow({
      where: { id: params.folioId },
      include: { hotel: true },
    });

    const balanceDue = Number(folio.balanceDue);
    if (balanceDue <= 0) {
      throw createLoyaltyError("Folio has no outstanding balance due to credit points against.");
    }

    // 1. Evaluate redemption cap & monetary conversion
    const capResult = calculateRedemptionCap({
      requestedPoints: points,
      availablePoints: account.availablePoints,
      folioEligibleBalanceInr: balanceDue,
      settings,
      tier: account.tier as LoyaltyTier,
    });

    if (points > capResult.maxPoints) {
      throw createLoyaltyError(
        `Redemption capped at ${capResult.maxPoints} points (₹${capResult.creditInr}) due to: ${capResult.cappedBy}`,
      );
    }

    const creditINR = calculateRedemptionValue(points, settings, account.tier as LoyaltyTier);
    if (creditINR <= 0) {
      throw createLoyaltyError("Calculated redemption credit amount must be greater than zero.");
    }

    const newBalance = account.availablePoints - points;
    const newRedeemedPoints = account.redeemedPoints + points;

    // 2. Create immutable LoyaltyTransaction (Debit)
    const transaction = await tx.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        hotelId: resolvedHotelId,
        type: "Redeem",
        points: -points,
        balanceAfter: newBalance,
        referenceFolioId: params.folioId,
        creditInr: creditINR as any,
        tier: account.tier as LoyaltyTier,
        description: `Redeemed ${points} points for ₹${creditINR.toLocaleString("en-IN")} folio credit`,
        createdByUserId: params.userId,
      },
    });

    // 3. Deduct points from LoyaltyAccount
    const updatedAccount = await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        availablePoints: newBalance,
        redeemedPoints: newRedeemedPoints,
      },
    });

    // 4. Folio Integration: Create Payment credit
    const count = await tx.payment.count({ where: { folioId: params.folioId } });
    const paymentNumber = `PAY-LOYALTY-${folio.hotel.code || "H"}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        folioId: params.folioId,
        guestId: folio.guestId,
        amount: creditINR as any,
        method: "Other",
        status: "Captured",
        isLoyaltyRedemption: true,
        loyaltyTransactionId: transaction.id,
        transactionRef: `Loyalty Redemption (${points} pts)`,
        notes: `Redeemed ${points} points for ₹${creditINR} credit`,
        receivedAt: new Date(),
      },
    });

    // Link payment back to transaction
    await tx.loyaltyTransaction.update({
      where: { id: transaction.id },
      data: { referencePaymentId: payment.id },
    });

    // 5. Centralized folio recalculation
    const { summary } = await recalculateFolio(tx, params.folioId);

    await recordAuditLog(
      {
        hotelId: resolvedHotelId,
        userId: params.userId,
        action: "LOYALTY_POINTS_REDEEMED",
        entity: "LoyaltyAccount",
        entityId: account.id,
        newValue: {
          pointsRedeemed: points,
          creditINR,
          folioId: params.folioId,
          paymentId: payment.id,
          balanceDue: summary.balanceDue,
        },
      },
      tx,
    );

    return {
      account: updatedAccount,
      transaction,
      payment,
      creditINR,
      newBalanceDue: summary.balanceDue,
    };
  });
}

/**
 * 4. Reverse Applicable Loyalty Transaction
 * When payment/refund is reversed, reverses the applicable loyalty transaction.
 */
export async function reverseLoyaltyTransaction(params: {
  transactionId: string;
  reason: string;
  userId?: string;
  hotelId?: string;
}) {
  const resolvedHotelId = params.hotelId ?? (await getDefaultHotelId());

  return await prisma.$transaction(async (tx) => {
    const original = await tx.loyaltyTransaction.findUnique({
      where: { id: params.transactionId },
      include: { loyaltyAccount: true },
    });

    if (!original) {
      throw createLoyaltyError(`Loyalty transaction not found: ${params.transactionId}`, undefined, 404);
    }

    // Check if already reversed
    const existingReversals = await tx.loyaltyTransaction.findMany({
      where: { reversalOfTransactionId: original.id },
      select: { id: true },
    });

    const reversalPlan = buildReversalPlan(original, existingReversals);
    if (!reversalPlan.isReversible) {
      throw createLoyaltyError(
        reversalPlan.errors.join(". ") || "This transaction cannot be reversed.",
      );
    }

    const account = original.loyaltyAccount;
    const isRedeem = original.type === "Redeem";
    const isEarn = original.type === "Earn";

    // Signed reversal points:
    // If original was Redeem (-1000 pts), reversal points is +1000 (credit back)
    // If original was Earn (+500 pts), reversal points is -500 (debit back)
    const deltaPoints = isRedeem ? Math.abs(original.points) : -Math.abs(original.points);
    const newAvailable = account.availablePoints + deltaPoints;

    if (newAvailable < 0) {
      throw createLoyaltyError(
        `Reversal would drive available balance negative (${newAvailable} points).`,
      );
    }

    // 1. Post immutable Reversal transaction
    const reversalTransaction = await tx.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        hotelId: resolvedHotelId,
        type: "Reversal",
        points: deltaPoints,
        balanceAfter: newAvailable,
        reversalOfTransactionId: original.id,
        referenceFolioId: original.referenceFolioId,
        referencePaymentId: original.referencePaymentId,
        description: `Reversal of ${original.type} #${original.id}: ${params.reason}`,
        notes: params.reason,
        createdByUserId: params.userId,
      },
    });

    // 2. Update account totals
    const updateData: any = { availablePoints: newAvailable };
    if (isRedeem) {
      updateData.redeemedPoints = Math.max(0, account.redeemedPoints - Math.abs(original.points));
    }
    if (isEarn) {
      updateData.lifetimePoints = Math.max(0, account.lifetimePoints - Math.abs(original.points));
      if (original.eligibleSpendInr) {
        updateData.lifetimeSpendInr = Math.max(
          0,
          Number(account.lifetimeSpendInr || 0) - Number(original.eligibleSpendInr),
        );
      }
    }

    const updatedAccount = await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: updateData,
    });

    // 3. If this was a redemption linked to a folio payment, update payment status
    if (isRedeem && original.referencePaymentId) {
      await tx.payment.update({
        where: { id: original.referencePaymentId },
        data: {
          status: "Refunded",
          notes: `Reversed via Loyalty Transaction #${reversalTransaction.id}`,
        },
      });

      if (original.referenceFolioId) {
        await recalculateFolio(tx, original.referenceFolioId);
      }
    }

    await recordAuditLog(
      {
        hotelId: resolvedHotelId,
        userId: params.userId,
        action: "LOYALTY_TRANSACTION_REVERSED",
        entity: "LoyaltyTransaction",
        entityId: original.id,
        newValue: {
          reversalId: reversalTransaction.id,
          originalType: original.type,
          deltaPoints,
          newBalance: newAvailable,
          reason: params.reason,
        },
      },
      tx,
    );

    return {
      account: updatedAccount,
      reversalTransaction,
      original,
    };
  });
}

/**
 * 5. Manual Loyalty Adjustment (Admin)
 */
export async function adjustLoyaltyPoints(params: {
  guestId: string;
  pointsDelta: number;
  reason: string;
  userId?: string;
  hotelId?: string;
}) {
  const resolvedHotelId = params.hotelId ?? (await getDefaultHotelId());
  const delta = Math.floor(Number(params.pointsDelta) || 0);

  if (delta === 0) {
    throw createLoyaltyError("Points adjustment delta cannot be zero.");
  }

  return await prisma.$transaction(async (tx) => {
    let account = await tx.loyaltyAccount.findUnique({ where: { guestId: params.guestId } });
    if (!account) {
      account = await tx.loyaltyAccount.create({
        data: { guestId: params.guestId, hotelId: resolvedHotelId, tier: "Bronze" },
      });
    }

    const newBalance = account.availablePoints + delta;
    if (newBalance < 0) {
      throw createLoyaltyError(
        `Adjustment would drive points negative (${newBalance}). Current balance: ${account.availablePoints}`,
      );
    }

    const transaction = await tx.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        hotelId: resolvedHotelId,
        type: "Adjustment",
        points: delta,
        balanceAfter: newBalance,
        description: `Manual adjustment: ${params.reason}`,
        notes: params.reason,
        createdByUserId: params.userId,
      },
    });

    const updatedAccount = await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        availablePoints: newBalance,
        lifetimePoints: delta > 0 ? account.lifetimePoints + delta : account.lifetimePoints,
      },
    });

    await recordAuditLog(
      {
        hotelId: resolvedHotelId,
        userId: params.userId,
        action: "LOYALTY_POINTS_ADJUSTED",
        entity: "LoyaltyAccount",
        entityId: account.id,
        newValue: {
          delta,
          newBalance,
          reason: params.reason,
          transactionId: transaction.id,
        },
      },
      tx,
    );

    return { account: updatedAccount, transaction };
  });
}
