-- MODULE 10 — LOYALTY PROGRAM
-- Extends the existing single-guest loyalty tables with:
--   1. Admin-configurable program settings (LoyaltySetting + LoyaltyTierRule)
--   2. An append-only ledger contract on LoyaltyTransaction
--   3. A reconciliation marker on Payment so refunds can reverse loyalty

-- CreateEnum
CREATE TYPE "LoyaltyExpiryBasis" AS ENUM ('EarnTransactionDate', 'CalendarYearEnd');

-- AlterTable
ALTER TABLE "LoyaltyAccount" ADD COLUMN     "hotelId" TEXT,
ADD COLUMN     "expiredPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lifetimeSpendInr" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "pointsExpiringQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tierChangedAt" TIMESTAMP(3),
ADD COLUMN     "lastEarnedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LoyaltyTransaction" ADD COLUMN     "hotelId" TEXT,
ADD COLUMN     "balanceAfter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reversalOfTransactionId" TEXT,
ADD COLUMN     "referencePaymentId" TEXT,
ADD COLUMN     "eligibleSpendInr" DECIMAL(12,2),
ADD COLUMN     "creditInr" DECIMAL(12,2),
ADD COLUMN     "tier" "LoyaltyTier" NOT NULL DEFAULT 'Bronze',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "createdByUserId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "isLoyaltyRedemption" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loyaltyTransactionId" TEXT,
ADD COLUMN     "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- CreateTable
CREATE TABLE "LoyaltySetting" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "basePointsPerRupee" DECIMAL(7,4) NOT NULL DEFAULT 0.05,
    "baseRedemptionValuePerPoint" DECIMAL(7,4) NOT NULL DEFAULT 0.50,
    "minPointsForRedemption" INTEGER NOT NULL DEFAULT 500,
    "maxRedemptionPercentPerFolio" DECIMAL(5,4) NOT NULL DEFAULT 0.50,
    "isEarningEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isRedemptionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "earnOnPaymentCapture" BOOLEAN NOT NULL DEFAULT true,
    "eligibleItemTypes" TEXT NOT NULL DEFAULT '["Room","Restaurant","InRoomDining","Food","Spa","Laundry","Banquet"]',
    "eligibleSacCodes" TEXT NOT NULL DEFAULT '[]',
    "isExpiryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "expiryMonths" INTEGER NOT NULL DEFAULT 24,
    "expiryGracePeriodMonths" INTEGER NOT NULL DEFAULT 3,
    "expiryBasis" "LoyaltyExpiryBasis" NOT NULL DEFAULT 'EarnTransactionDate',
    "lastExpiryRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTierRule" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "tier" "LoyaltyTier" NOT NULL,
    "thresholdLifetimeSpendInr" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "pointsPerRupee" DECIMAL(7,4) NOT NULL DEFAULT 0.05,
    "redemptionValuePerPoint" DECIMAL(7,4) NOT NULL DEFAULT 0.50,
    "monthlyBonusPoints" INTEGER NOT NULL DEFAULT 0,
    "minPointsForRedemption" INTEGER NOT NULL DEFAULT 500,
    "maxRedemptionPercentPerFolio" DECIMAL(5,4) NOT NULL DEFAULT 0.50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyTierRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltySetting_hotelId_key" ON "LoyaltySetting"("hotelId");

-- CreateIndex
CREATE INDEX "LoyaltySetting_hotelId_idx" ON "LoyaltySetting"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTierRule_hotelId_tier_key" ON "LoyaltyTierRule"("hotelId", "tier");

-- CreateIndex
CREATE INDEX "LoyaltyTierRule_hotelId_idx" ON "LoyaltyTierRule"("hotelId");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_hotelId_idx" ON "LoyaltyAccount"("hotelId");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_tier_idx" ON "LoyaltyAccount"("tier");

-- A ledger row may be reversed at most once — the unique index makes a
-- double-reversal impossible even under concurrent requests.
-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTransaction_reversalOfTransactionId_key" ON "LoyaltyTransaction"("reversalOfTransactionId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_loyaltyAccountId_idx" ON "LoyaltyTransaction"("loyaltyAccountId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_hotelId_idx" ON "LoyaltyTransaction"("hotelId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_type_idx" ON "LoyaltyTransaction"("type");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_referenceFolioId_idx" ON "LoyaltyTransaction"("referenceFolioId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_referencePaymentId_idx" ON "LoyaltyTransaction"("referencePaymentId");

-- CreateIndex
CREATE INDEX "Payment_isLoyaltyRedemption_idx" ON "Payment"("isLoyaltyRedemption");

-- AddForeignKey
ALTER TABLE "LoyaltySetting" ADD CONSTRAINT "LoyaltySetting_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTierRule" ADD CONSTRAINT "LoyaltyTierRule_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTierRule" ADD CONSTRAINT "LoyaltyTierRule_setting_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "LoyaltySetting"("hotelId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_reversalOfTransactionId_fkey" FOREIGN KEY ("reversalOfTransactionId") REFERENCES "LoyaltyTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill the ledger contract for any pre-existing loyalty rows so that
-- availablePoints === SUM(points) and balanceAfter === running SUM(points)
-- hold immediately after the migration, with no manual repair step.
WITH running AS (
    SELECT
        t.id,
        SUM(t."points") OVER (
            PARTITION BY t."loyaltyAccountId"
            ORDER BY t."createdAt" ASC, t.id ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS computed
    FROM "LoyaltyTransaction" t
)
UPDATE "LoyaltyTransaction" t
SET "balanceAfter" = running.computed
FROM running
WHERE t.id = running.id;