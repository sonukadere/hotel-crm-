import { prisma } from "../db/prisma";
import { LOYALTY_CONFIG } from "@hotel/config";
import type {
  FolioItemType,
  LoyaltyProgramSettings,
  LoyaltyTier,
  LoyaltyTierRule,
} from "@hotel/types";
import {
  getDefaultLoyaltySettings,
  normalizeLoyaltySettings,
  normalizeItemTypeList,
  normalizeSacCodeList,
  validateLoyaltyProgramSettings,
} from "@hotel/utils";
import { recordAuditLog } from "./auditService";

/**
 * MODULE 10 — LOYALTY SETTINGS (admin configurable)
 *
 * Tier thresholds, points per ₹, redemption value, expiry rules and eligible
 * services all live here so nothing about the programme is hard-coded in a
 * deployed service. `LOYALTY_CONFIG` only bootstraps a brand new property.
 */

/** Resolves the hotel whose programme settings apply (mirrors roomService). */
export async function getDefaultHotelId(): Promise<string> {
  const hotel = await prisma.hotel.findFirst({ orderBy: { createdAt: "asc" } });
  if (!hotel) throw new Error("No hotel configured. Run the database seed first.");
  return hotel.id;
}

function serializeTierRule(rule: {
  id: string;
  hotelId: string;
  tier: LoyaltyTier;
  thresholdLifetimeSpendInr: unknown;
  pointsPerRupee: unknown;
  redemptionValuePerPoint: unknown;
  monthlyBonusPoints: number;
  minPointsForRedemption: number;
  maxRedemptionPercentPerFolio: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): LoyaltyTierRule {
  return {
    id: rule.id,
    hotelId: rule.hotelId,
    tier: rule.tier,
    thresholdLifetimeSpendInr: Number(rule.thresholdLifetimeSpendInr),
    pointsPerRupee: Number(rule.pointsPerRupee),
    redemptionValuePerPoint: Number(rule.redemptionValuePerPoint),
    monthlyBonusPoints: rule.monthlyBonusPoints,
    minPointsForRedemption: rule.minPointsForRedemption,
    maxRedemptionPercentPerFolio: Number(rule.maxRedemptionPercentPerFolio),
    isActive: rule.isActive,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

function serializeSetting(setting: {
  id: string;
  hotelId: string;
  basePointsPerRupee: unknown;
  baseRedemptionValuePerPoint: unknown;
  minPointsForRedemption: number;
  maxRedemptionPercentPerFolio: unknown;
  isEarningEnabled: boolean;
  isRedemptionEnabled: boolean;
  earnOnPaymentCapture: boolean;
  eligibleItemTypes: string;
  eligibleSacCodes: string;
  isExpiryEnabled: boolean;
  expiryMonths: number;
  expiryGracePeriodMonths: number;
  expiryBasis: string;
  lastExpiryRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}, tiers: LoyaltyTierRule[]): LoyaltyProgramSettings {
  return normalizeLoyaltySettings({
    hotelId: setting.hotelId,
    basePointsPerRupee: Number(setting.basePointsPerRupee),
    baseRedemptionValuePerPoint: Number(setting.baseRedemptionValuePerPoint),
    minPointsForRedemption: setting.minPointsForRedemption,
    maxRedemptionPercentPerFolio: Number(setting.maxRedemptionPercentPerFolio),
    isEarningEnabled: setting.isEarningEnabled,
    isRedemptionEnabled: setting.isRedemptionEnabled,
    earnOnPaymentCapture: setting.earnOnPaymentCapture,
    eligibleItemTypes: normalizeItemTypeList(setting.eligibleItemTypes),
    eligibleSacCodes: normalizeSacCodeList(setting.eligibleSacCodes),
    isExpiryEnabled: setting.isExpiryEnabled,
    expiryMonths: setting.expiryMonths,
    expiryGracePeriodMonths: setting.expiryGracePeriodMonths,
    expiryBasis: setting.expiryBasis as LoyaltyProgramSettings["expiryBasis"],
    tiers,
  }, setting.hotelId);
}

/**
 * Reads the programme configuration for a property, transparently creating the
 * default row on first access so no call site has to handle "not configured".
 */
export async function getLoyaltySettings(
  hotelId?: string,
): Promise<{ settings: LoyaltyProgramSettings; isSeeded: boolean }> {
  const resolvedHotelId = hotelId ?? (await getDefaultHotelId());

  const existing = await prisma.loyaltySetting.findUnique({
    where: { hotelId: resolvedHotelId },
    include: { tiers: true },
  });

  if (existing) {
    const tiers = [...existing.tiers]
      .map(serializeTierRule)
      .sort((a, b) => a.thresholdLifetimeSpendInr - b.thresholdLifetimeSpendInr);

    // A setting row with no tier rules is treated as unseeded and repaired.
    if (tiers.length === 0) {
      await seedLoyaltySettings(resolvedHotelId);
      const refreshed = await prisma.loyaltySetting.findUniqueOrThrow({
        where: { hotelId: resolvedHotelId },
        include: { tiers: true },
      });
      return {
        settings: serializeSetting(
          refreshed,
          refreshed.tiers
            .map(serializeTierRule)
            .sort((a, b) => a.thresholdLifetimeSpendInr - b.thresholdLifetimeSpendInr),
        ),
        isSeeded: true,
      };
    }

    return { settings: serializeSetting(existing, tiers), isSeeded: true };
  }

  await seedLoyaltySettings(resolvedHotelId);
  const created = await prisma.loyaltySetting.findUniqueOrThrow({
    where: { hotelId: resolvedHotelId },
    include: { tiers: true },
  });

  return {
    settings: serializeSetting(
      created,
      created.tiers
        .map(serializeTierRule)
        .sort((a, b) => a.thresholdLifetimeSpendInr - b.thresholdLifetimeSpendInr),
    ),
    isSeeded: false,
  };
}

/** Writes the default programme configuration for a property. Idempotent. */
export async function seedLoyaltySettings(hotelId: string): Promise<LoyaltyProgramSettings> {
  const defaults = getDefaultLoyaltySettings(hotelId);

  await prisma.loyaltySetting.upsert({
    where: { hotelId },
    update: {},
    create: {
      hotelId,
      basePointsPerRupee: defaults.basePointsPerRupee as any,
      baseRedemptionValuePerPoint: defaults.baseRedemptionValuePerPoint as any,
      minPointsForRedemption: defaults.minPointsForRedemption,
      maxRedemptionPercentPerFolio: defaults.maxRedemptionPercentPerFolio as any,
      isEarningEnabled: defaults.isEarningEnabled,
      isRedemptionEnabled: defaults.isRedemptionEnabled,
      earnOnPaymentCapture: defaults.earnOnPaymentCapture,
      eligibleItemTypes: JSON.stringify(defaults.eligibleItemTypes),
      eligibleSacCodes: JSON.stringify(defaults.eligibleSacCodes),
      isExpiryEnabled: defaults.isExpiryEnabled,
      expiryMonths: defaults.expiryMonths,
      expiryGracePeriodMonths: defaults.expiryGracePeriodMonths,
      expiryBasis: defaults.expiryBasis as any,
      tiers: {
        create: defaults.tiers.map((rule) => ({
          hotelId,
          tier: rule.tier as any,
          thresholdLifetimeSpendInr: rule.thresholdLifetimeSpendInr as any,
          pointsPerRupee: rule.pointsPerRupee as any,
          redemptionValuePerPoint: rule.redemptionValuePerPoint as any,
          monthlyBonusPoints: rule.monthlyBonusPoints,
          minPointsForRedemption: rule.minPointsForRedemption,
          maxRedemptionPercentPerFolio: rule.maxRedemptionPercentPerFolio as any,
          isActive: rule.isActive,
        })),
      },
    },
  });

  const { settings } = await getLoyaltySettings(hotelId);
  return settings;
}

export interface UpdateLoyaltySettingsParams {
  hotelId?: string;
  basePointsPerRupee?: number;
  baseRedemptionValuePerPoint?: number;
  minPointsForRedemption?: number;
  maxRedemptionPercentPerFolio?: number;
  isEarningEnabled?: boolean;
  isRedemptionEnabled?: boolean;
  earnOnPaymentCapture?: boolean;
  eligibleItemTypes?: FolioItemType[] | string;
  eligibleSacCodes?: string[] | string;
  isExpiryEnabled?: boolean;
  expiryMonths?: number;
  expiryGracePeriodMonths?: number;
  expiryBasis?: LoyaltyProgramSettings["expiryBasis"];
  tiers?: Array<{
    tier: LoyaltyTier;
    thresholdLifetimeSpendInr: number;
    pointsPerRupee: number;
    redemptionValuePerPoint: number;
    monthlyBonusPoints?: number;
    minPointsForRedemption?: number;
    maxRedemptionPercentPerFolio?: number;
    isActive?: boolean;
  }>;
  /** Report non-blocking advisories without failing the update. */
  userId?: string;
}

/**
 * Applies an admin settings change.
 *
 * The payload is validated and normalised *before* anything is written, so a
 * rejected update leaves the existing configuration untouched. Tier rules are
 * upserted by `(hotelId, tier)` — the PRD requires exactly Bronze, Silver and
 * Gold, so tiers are never created or deleted, only reconfigured.
 */
export async function updateLoyaltySettings(params: UpdateLoyaltySettingsParams) {
  const hotelId = params.hotelId ?? (await getDefaultHotelId());
  const { settings: current } = await getLoyaltySettings(hotelId);

  const next: LoyaltyProgramSettings = normalizeLoyaltySettings(
    {
      ...current,
      ...(params.basePointsPerRupee !== undefined && {
        basePointsPerRupee: params.basePointsPerRupee,
      }),
      ...(params.baseRedemptionValuePerPoint !== undefined && {
        baseRedemptionValuePerPoint: params.baseRedemptionValuePerPoint,
      }),
      ...(params.minPointsForRedemption !== undefined && {
        minPointsForRedemption: params.minPointsForRedemption,
      }),
      ...(params.maxRedemptionPercentPerFolio !== undefined && {
        maxRedemptionPercentPerFolio: params.maxRedemptionPercentPerFolio,
      }),
      ...(params.isEarningEnabled !== undefined && {
        isEarningEnabled: params.isEarningEnabled,
      }),
      ...(params.isRedemptionEnabled !== undefined && {
        isRedemptionEnabled: params.isRedemptionEnabled,
      }),
      ...(params.earnOnPaymentCapture !== undefined && {
        earnOnPaymentCapture: params.earnOnPaymentCapture,
      }),
      ...(params.eligibleItemTypes !== undefined && {
        eligibleItemTypes: normalizeItemTypeList(params.eligibleItemTypes) as FolioItemType[],
      }),
      ...(params.eligibleSacCodes !== undefined && {
        eligibleSacCodes: normalizeSacCodeList(params.eligibleSacCodes),
      }),
      ...(params.isExpiryEnabled !== undefined && { isExpiryEnabled: params.isExpiryEnabled }),
      ...(params.expiryMonths !== undefined && { expiryMonths: params.expiryMonths }),
      ...(params.expiryGracePeriodMonths !== undefined && {
        expiryGracePeriodMonths: params.expiryGracePeriodMonths,
      }),
      ...(params.expiryBasis !== undefined && { expiryBasis: params.expiryBasis }),
      ...(params.tiers !== undefined && {
        tiers: params.tiers.map((rule) => {
          const existingRule = current.tiers.find((t) => t.tier === rule.tier);
          return normalizeTierRuleInput(rule, existingRule, current, hotelId);
        }),
      }),
    },
    hotelId,
  );

  const validation = validateLoyaltyProgramSettings(next);
  if (!validation.isValid) {
    throw new Error(`Invalid loyalty settings: ${validation.errors.join("; ")}`);
  }

  await prisma.$transaction(async (tx) => {
    const settingUpdate: any = {
      basePointsPerRupee: next.basePointsPerRupee as any,
      baseRedemptionValuePerPoint: next.baseRedemptionValuePerPoint as any,
      minPointsForRedemption: next.minPointsForRedemption,
      maxRedemptionPercentPerFolio: next.maxRedemptionPercentPerFolio as any,
      isEarningEnabled: next.isEarningEnabled,
      isRedemptionEnabled: next.isRedemptionEnabled,
      earnOnPaymentCapture: next.earnOnPaymentCapture,
      eligibleItemTypes: JSON.stringify(next.eligibleItemTypes),
      eligibleSacCodes: JSON.stringify(next.eligibleSacCodes),
      isExpiryEnabled: next.isExpiryEnabled,
      expiryMonths: next.expiryMonths,
      expiryGracePeriodMonths: next.expiryGracePeriodMonths,
      expiryBasis: next.expiryBasis as any,
    };

    await tx.loyaltySetting.upsert({
      where: { hotelId },
      update: settingUpdate,
      create: { hotelId, ...settingUpdate },
    });

    for (const rule of next.tiers) {
      const data = {
        tier: rule.tier as any,
        thresholdLifetimeSpendInr: rule.thresholdLifetimeSpendInr as any,
        pointsPerRupee: rule.pointsPerRupee as any,
        redemptionValuePerPoint: rule.redemptionValuePerPoint as any,
        monthlyBonusPoints: rule.monthlyBonusPoints,
        minPointsForRedemption: rule.minPointsForRedemption,
        maxRedemptionPercentPerFolio: rule.maxRedemptionPercentPerFolio as any,
        isActive: rule.isActive,
      };

      await tx.loyaltyTierRule.upsert({
        where: { hotelId_tier: { hotelId, tier: rule.tier as any } },
        update: data,
        create: { hotelId, ...data },
      });
    }
  });

  await recordAuditLog({
    hotelId,
    userId: params.userId,
    action: "LOYALTY_SETTINGS_UPDATED",
    entity: "LoyaltySetting",
    entityId: hotelId,
    previousValue: {
      basePointsPerRupee: current.basePointsPerRupee,
      baseRedemptionValuePerPoint: current.baseRedemptionValuePerPoint,
      eligibleItemTypes: current.eligibleItemTypes,
      expiryMonths: current.expiryMonths,
      tiers: current.tiers.map((t) => ({
        tier: t.tier,
        thresholdLifetimeSpendInr: t.thresholdLifetimeSpendInr,
      })),
    },
    newValue: {
      basePointsPerRupee: next.basePointsPerRupee,
      baseRedemptionValuePerPoint: next.baseRedemptionValuePerPoint,
      eligibleItemTypes: next.eligibleItemTypes,
      expiryMonths: next.expiryMonths,
      tiers: next.tiers.map((t) => ({
        tier: t.tier,
        thresholdLifetimeSpendInr: t.thresholdLifetimeSpendInr,
      })),
    },
  });

  return { settings: next, warnings: validation.warnings };
}

function normalizeTierRuleInput(
  rule: NonNullable<UpdateLoyaltySettingsParams["tiers"]>[number],
  existingRule: LoyaltyTierRule | undefined,
  current: LoyaltyProgramSettings,
  hotelId: string,
): LoyaltyTierRule {
  const now = new Date().toISOString();
  return {
    id: existingRule?.id ?? "",
    hotelId,
    tier: rule.tier,
    thresholdLifetimeSpendInr: rule.thresholdLifetimeSpendInr,
    pointsPerRupee: rule.pointsPerRupee,
    redemptionValuePerPoint: rule.redemptionValuePerPoint,
    monthlyBonusPoints: rule.monthlyBonusPoints ?? existingRule?.monthlyBonusPoints ?? 0,
    minPointsForRedemption: rule.minPointsForRedemption ?? existingRule?.minPointsForRedemption ?? current.minPointsForRedemption,
    maxRedemptionPercentPerFolio:
      rule.maxRedemptionPercentPerFolio ??
      existingRule?.maxRedemptionPercentPerFolio ??
      current.maxRedemptionPercentPerFolio,
    isActive: rule.isActive ?? existingRule?.isActive ?? true,
    createdAt: existingRule?.createdAt ?? now,
    updatedAt: now,
  };
}

/** Restores the shipped defaults, discarding every admin override. */
export async function resetLoyaltySettings(params: { hotelId?: string; userId?: string }) {
  const hotelId = params.hotelId ?? (await getDefaultHotelId());

  const previous = await prisma.loyaltySetting.findUnique({
    where: { hotelId },
    include: { tiers: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.loyaltyTierRule.deleteMany({ where: { hotelId } });
    await tx.loyaltySetting.deleteMany({ where: { hotelId } });
  });

  const settings = await seedLoyaltySettings(hotelId);

  await recordAuditLog({
    hotelId,
    userId: params.userId,
    action: "LOYALTY_SETTINGS_RESET",
    entity: "LoyaltySetting",
    entityId: hotelId,
    previousValue: {
      basePointsPerRupee: previous ? Number(previous.basePointsPerRupee) : LOYALTY_CONFIG.BASE_POINTS_PER_RUPEE,
      tierCount: previous?.tiers.length ?? 0,
    },
    newValue: {
      basePointsPerRupee: settings.basePointsPerRupee,
      tierCount: settings.tiers.length,
    },
  });

  return { settings };
}

/** Admin view of the tier ladder for the CRM settings console. */
export async function getLoyaltyTiers(hotelId?: string) {
  const { settings } = await getLoyaltySettings(hotelId);

  const tiers = [...settings.tiers]
    .sort((a, b) => b.thresholdLifetimeSpendInr - a.thresholdLifetimeSpendInr)
    .map((rule) => ({
      tier: rule.tier,
      thresholdLifetimeSpendInr: rule.thresholdLifetimeSpendInr,
      pointsPerRupee: rule.pointsPerRupee,
      pointsPer100Inr: Math.round(rule.pointsPerRupee * 100),
      redemptionValuePerPoint: rule.redemptionValuePerPoint,
      minPointsForRedemption: rule.minPointsForRedemption,
      maxRedemptionPercentPerFolio: rule.maxRedemptionPercentPerFolio,
      monthlyBonusPoints: rule.monthlyBonusPoints,
      isActive: rule.isActive,
    }));

  return {
    tiers,
    eligibleItemTypes: settings.eligibleItemTypes,
    eligibleSacCodes: settings.eligibleSacCodes,
    isEarningEnabled: settings.isEarningEnabled,
    isRedemptionEnabled: settings.isRedemptionEnabled,
    earnOnPaymentCapture: settings.earnOnPaymentCapture,
    expiry: {
      isExpiryEnabled: settings.isExpiryEnabled,
      expiryMonths: settings.expiryMonths,
      expiryGracePeriodMonths: settings.expiryGracePeriodMonths,
      expiryBasis: settings.expiryBasis,
    },
  };
}