import { z } from "zod";

/**
 * Zod request schemas.
 *
 * Body schemas that are handed to an existing service use `.passthrough()`:
 * known fields are type-checked, unknown fields keep flowing through untouched
 * so no service silently loses input.
 */

const passthrough = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();

const id = z.string().trim().min(1).max(64);
const optionalId = id.nullish();
const isoDateLike = z.string().trim().min(4).max(40);
const amount = z.coerce.number().finite().positive();
const optionalAmount = z.coerce.number().finite().nonnegative().optional();
const notes = z.string().max(2000).optional();

export const USER_ROLES = ["SuperAdmin", "Admin", "Manager", "FrontDesk", "Housekeeping", "Accountant"] as const;

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(10).max(128),
  })
  .strict();

export const createUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(10).max(128),
    role: z.enum(USER_ROLES),
    hotelId: optionalId,
  })
  .strict();

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional(),
    hotelId: optionalId,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to update" });

// ---------------------------------------------------------------------------
// Reservations & front desk
// ---------------------------------------------------------------------------

export const reservationCreateSchema = passthrough({
  hotelId: optionalId,
  roomId: optionalId,
  roomTypeId: id,
  ratePlanId: id,
  checkInDate: isoDateLike,
  checkOutDate: isoDateLike,
  adults: z.coerce.number().int().min(1).max(99),
  children: z.coerce.number().int().min(0).max(99).optional(),
  mealPlan: z.enum(["EP", "CP", "MAP", "AP"]).optional(),
  bookingSource: z.string().trim().max(60).optional(),
  specialRequests: z.string().max(2000).optional(),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  discountFlat: z.coerce.number().min(0).optional(),
  guest: passthrough({
    fullName: z.string().trim().min(1).max(200),
    mobile: z.string().trim().min(8).max(20),
    email: z.union([z.string().trim().email(), z.literal(""), z.null()]).optional(),
  }),
});

export const reservationQuoteSchema = passthrough({
  hotelId: optionalId,
  roomId: optionalId,
  roomTypeId: id.optional(),
  ratePlanId: id.optional(),
  checkInDate: isoDateLike,
  checkOutDate: isoDateLike,
  adults: z.coerce.number().int().min(1).max(99).optional(),
  children: z.coerce.number().int().min(0).max(99).optional(),
  mealPlan: z.enum(["EP", "CP", "MAP", "AP"]).optional(),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  discountFlat: z.coerce.number().min(0).optional(),
});

export const checkInSchema = passthrough({
  bookingId: id,
  roomId: optionalId,
});

export const checkOutSchema = passthrough({
  bookingId: id,
});

export const roomSwitchSchema = passthrough({
  bookingId: id,
  newRoomId: id,
  reason: z.string().trim().min(1).max(500),
});

export const guestUpsertSchema = passthrough({
  guestId: optionalId,
  mobile: z.string().trim().min(8).max(20),
  fullName: z.string().trim().max(200).optional(),
  email: z.union([z.string().trim().email(), z.literal(""), z.null()]).optional(),
  idNumber: z.string().trim().max(64).optional(),
  corporateGstin: z
    .string()
    .trim()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i, "Corporate GSTIN must be a valid 15-character GSTIN")
    .optional(),
});

// ---------------------------------------------------------------------------
// Folios, payments, invoices
// ---------------------------------------------------------------------------

export const folioItemSchema = passthrough({
  itemType: z.enum([
    "Room",
    "Food",
    "Restaurant",
    "InRoomDining",
    "Laundry",
    "Spa",
    "Housekeeping",
    "Banquet",
    "OtherService",
    "Discount",
  ]),
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().int().min(1).max(9999),
  unitPrice: z.coerce.number().finite().min(0),
  customGstRate: z.coerce.number().min(0).max(1).optional(),
  splitTarget: z.enum(["Corporate", "Personal"]).optional(),
});

export const folioItemEditSchema = passthrough({
  description: z.string().trim().min(1).max(500).optional(),
  quantity: z.coerce.number().int().min(1).max(9999).optional(),
  unitPrice: z.coerce.number().finite().min(0).optional(),
  splitTarget: z.enum(["Corporate", "Personal"]).optional(),
});

export const voidReasonSchema = passthrough({
  reason: z.string().trim().min(1).max(500),
});

export const discountSchema = passthrough({
  amount,
  reason: z.string().trim().min(1).max(500),
  splitTarget: z.enum(["Corporate", "Personal"]).optional(),
});

export const paymentSchema = passthrough({
  amount,
  method: z.enum(["Cash", "UPI", "Card", "Razorpay", "Bank_Transfer", "Other"]),
  transactionRef: z.string().trim().max(120).optional(),
  panNumber: z
    .string()
    .trim()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/i, "PAN must be in the format ABCDE1234F")
    .optional(),
  notes,
  isAdvance: z.boolean().optional(),
});

export const refundSchema = passthrough({
  amount: optionalAmount,
  reason: z.string().trim().min(1).max(500),
});

export const razorpayOrderSchema = passthrough({
  folioId: id,
  amount: optionalAmount,
});

export const razorpayVerifySchema = passthrough({
  folioId: id,
  razorpayOrderId: z.string().trim().min(1).max(120),
  razorpayPaymentId: z.string().trim().min(1).max(120),
  razorpaySignature: z.string().trim().min(1).max(256),
  amount: optionalAmount,
  notes,
});

// ---------------------------------------------------------------------------
// Rooms, CRM, loyalty, night audit, reports
// ---------------------------------------------------------------------------

export const roomSchema = passthrough({
  roomNumber: z.string().trim().min(1).max(20),
  floorId: id,
  roomTypeId: id,
  bedTypeId: optionalId,
  status: z
    .enum(["Available", "Clean", "Dirty", "Occupied", "Blocked", "Maintenance"])
    .optional(),
  baseRate: z.coerce.number().finite().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const roomStatusSchema = passthrough({
  status: z.enum(["Available", "Clean", "Dirty", "Occupied", "Blocked", "Maintenance"]),
});

export const bulkRoomStatusSchema = passthrough({
  roomIds: z.array(id).min(1).max(500),
  status: z.enum(["Available", "Clean", "Dirty", "Occupied", "Blocked", "Maintenance"]),
});

export const leadStatusSchema = passthrough({
  status: z.enum(["New", "Contacted", "Qualified", "Converted", "Lost"]),
});

export const leadCreateSchema = passthrough({
  guestName: z.string().trim().min(1).max(200),
  mobile: z.string().trim().min(8).max(20),
  email: z.union([z.string().trim().email(), z.literal(""), z.null()]).optional(),
  source: z.string().trim().max(60).optional(),
  requirement: z.string().max(1000).optional(),
  status: z.enum(["New", "Contacted", "Qualified", "Converted", "Lost"]).optional(),
});

export const loyaltyEarnSchema = passthrough({
  guestId: id,
  hotelId: optionalId,
  eligibleSpendINR: z.coerce.number().finite().positive(),
  referenceFolioId: optionalId,
  referencePaymentId: optionalId,
  description: z.string().max(500).optional(),
});

export const loyaltyRedeemSchema = passthrough({
  guestId: id,
  hotelId: optionalId,
  folioId: id,
  pointsToRedeem: z.coerce.number().int().positive(),
});

export const loyaltyReverseSchema = passthrough({
  transactionId: id,
  hotelId: optionalId,
  reason: z.string().trim().min(1).max(500),
});

export const loyaltyAdjustSchema = passthrough({
  guestId: id,
  hotelId: optionalId,
  pointsDelta: z.coerce.number().int().refine((value) => value !== 0, "pointsDelta must not be zero"),
  reason: z.string().trim().min(1).max(500),
});

export const loyaltySettingsUpdateSchema = passthrough({
  hotelId: optionalId,
  basePointsPerRupee: z.coerce.number().min(0).max(10).optional(),
  baseRedemptionValuePerPoint: z.coerce.number().min(0).max(100).optional(),
  minPointsForRedemption: z.coerce.number().int().min(0).optional(),
  maxRedemptionPercentPerFolio: z.coerce.number().min(0).max(1).optional(),
  isEarningEnabled: z.boolean().optional(),
  isRedemptionEnabled: z.boolean().optional(),
  earnOnPaymentCapture: z.boolean().optional(),
  isExpiryEnabled: z.boolean().optional(),
  expiryMonths: z.coerce.number().int().min(1).max(120).optional(),
  expiryGracePeriodMonths: z.coerce.number().int().min(0).max(60).optional(),
  expiryBasis: z.enum(["EarnTransactionDate", "CalendarYearEnd"]).optional(),
  eligibleItemTypes: z.array(z.string().max(40)).max(30).optional(),
  eligibleSacCodes: z.array(z.string().max(20)).max(50).optional(),
  tiers: z.array(passthrough({ tier: z.enum(["Bronze", "Silver", "Gold"]) })).max(10).optional(),
});

export const nightAuditRunSchema = passthrough({
  hotelId: optionalId,
  businessDate: isoDateLike,
});

export const invoiceQuerySchema = z.object({
  invoiceType: z.enum(["Consolidated", "Corporate", "Personal"]).optional(),
});

export const auditLogQuerySchema = z.object({
  entity: z.string().trim().min(1).max(60).optional(),
  action: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const reportQuerySchema = z.object({
  startDate: isoDateLike,
  endDate: isoDateLike,
});
