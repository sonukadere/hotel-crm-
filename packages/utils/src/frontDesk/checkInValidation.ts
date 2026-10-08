import type {
  CheckInValidationCheck,
  CheckInValidationResult,
  IdentityType,
} from "@hotel/types";
import { roundCurrency } from "../formatters";
import { isValidIndianMobile, maskAadhaar } from "../masking";
import {
  isValidGSTIN,
  validateIdentityDocument,
  validateInternationalGuest,
  validateCashCompliance,
} from "../gst/gstValidators";

export interface CheckInIdentityInput {
  identityType?: IdentityType | string;
  idNumber?: string;
  maskedIdNumber?: string;
  issuedCountry?: string;
  expiryDate?: string | null;
}

export interface CheckInGuestInput {
  fullName?: string;
  mobile?: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  stateCode?: string | null;
  country?: string | null;
  guestType?: string;
  corporateGstin?: string | null;
  corporateName?: string | null;
  identities?: CheckInIdentityInput[];
  internationalDetails?: {
    passportNumber?: string;
    visaNumber?: string;
    visaExpiry?: string;
    nationality?: string;
    arrivalDate?: string;
    departureDate?: string;
    arrivalPort?: string;
  } | null;
}

export interface CheckInValidationInput {
  bookingId: string;
  booking?: {
    status: string;
    checkInDate: string;
    checkOutDate: string;
    grandTotal: number;
    paidAmount: number;
  } | null;
  room?: {
    id: string;
    roomNumber: string;
    status: string;
    isActive?: boolean;
  } | null;
  guest?: CheckInGuestInput | null;
  /** Nights actually elapsed vs booked, so early/late departures can be flagged. */
  depositCollected?: number;
  depositAmount?: number;
  additionalPayment?: {
    amount: number;
    method?: string;
    panNumber?: string;
  };
  availability?: {
    isSellable: boolean;
    reason?: string;
    conflicts?: Array<{ bookingNumber: string; guestName: string }>;
  };
  roomCharges?: number;
  taxAmount?: number;
}

/**
 * Full pre-arrival gate for a check-in.
 *
 * Checks run in the order the brief specifies:
 *  booking exists -> room available -> guest information complete ->
 *  required compliance information -> payment / deposit
 *
 * Blocking failures must all be cleared before the PMS will release a room key.
 */
export function buildCheckInValidation(
  input: CheckInValidationInput,
): CheckInValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: CheckInValidationCheck[] = [];

  const push = (
    key: string,
    label: string,
    passed: boolean,
    message: string,
    blocking = true,
  ) => {
    checks.push({ key, label, passed, blocking, message });
    if (!passed) {
      if (blocking) errors.push(message);
      else warnings.push(message);
    }
  };

  // ---------------------------------------------------------------- booking exists
  if (!input.booking) {
    push("booking", "Booking exists", false, "No booking found for this reservation");
    return finalise(input, errors, warnings, checks);
  }

  push(
    "booking",
    "Booking exists",
    true,
    `Booking ${input.booking.status} for ${input.booking.checkInDate} → ${input.booking.checkOutDate}`,
  );

  // ---------------------------------------------------------------- booking status
  const statusOk = ["Tentative", "Confirmed"].includes(input.booking.status);
  push(
    "bookingStatus",
    "Booking is check-in eligible",
    statusOk,
    statusOk
      ? "Reservation is confirmed and awaiting arrival"
      : input.booking.status === "CheckedIn"
        ? "Guest is already checked in to this room"
        : `Cannot check in a booking with status ${input.booking.status}`,
  );

  // ---------------------------------------------------------------- room available
  if (!input.room) {
    push("roomAssigned", "Room is assigned", false, "No room is assigned to this booking");
  } else {
    push(
      "roomAssigned",
      "Room is assigned",
      true,
      `Room ${input.room.roomNumber} (${input.room.status})`,
    );

    const roomOk = input.availability
      ? input.availability.isSellable
      : input.room.status !== "Occupied" && input.room.status !== "Blocked" && input.room.status !== "Maintenance";

    push(
      "roomAvailable",
      "Room is available",
      roomOk,
      input.availability?.reason ??
        (roomOk
          ? `Room ${input.room.roomNumber} is free for these nights`
          : `Room ${input.room.roomNumber} cannot be occupied (${input.room.status})`),
    );
  }

  // ---------------------------------------------------------------- guest information
  const guest = input.guest;
  if (!guest) {
    push("guestInfo", "Guest information complete", false, "No guest record linked to this booking");
  } else {
    const nameOk = Boolean(guest.fullName && guest.fullName.trim().length >= 3);
    const mobileOk = isValidIndianMobile(guest.mobile ?? "");
    const addressOk = Boolean(guest.address && guest.address.trim().length >= 4);
    const stateOk = Boolean(guest.state || guest.stateCode);
    const contactOk = !guest.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email);

    const failures: string[] = [];
    if (!nameOk) failures.push("Guest full name is required");
    if (!mobileOk) failures.push("A valid 10-digit Indian mobile is required");
    if (!addressOk) failures.push("Guest address is required for police verification");
    if (!stateOk) failures.push("Guest state is required to determine GST place of supply");
    if (!contactOk) failures.push("Guest email address is invalid");

    push(
      "guestInfo",
      "Guest information complete",
      failures.length === 0,
      failures.length === 0
        ? `${guest.fullName} • ${guest.mobile}`
        : failures.join("; "),
    );
  }

  // ---------------------------------------------------------------- compliance
  const identity = guest?.identities?.find((i) => i.identityType === "Aadhaar")
    ?? guest?.identities?.[0];

  if (!identity || !identity.identityType || !identity.idNumber) {
    push(
      "identity",
      "Identity proof captured",
      false,
      "A government identity proof (Aadhaar / Passport / PAN / DL / Voter ID) is mandatory",
    );
  } else {
    const doc = validateIdentityDocument(
      identity.identityType as IdentityType,
      identity.idNumber,
    );
    const masked =
      identity.maskedIdNumber ||
      (identity.identityType === "Aadhaar"
        ? maskAadhaar(identity.idNumber)
        : `****${identity.idNumber.slice(-4)}`);
    push(
      "identity",
      "Identity proof captured",
      doc.isValid,
      doc.isValid
        ? `${identity.identityType} on file • stored as ${masked}`
        : doc.error ?? `Invalid ${identity.identityType} number`,
    );
  }

  if (guest?.guestType === "International") {
    const frro = validateInternationalGuest(guest.internationalDetails ?? {});
    push(
      "international",
      "FRRO / Form C compliance",
      frro.isValid,
      frro.isValid
        ? "Passport, visa and arrival details on file for Form C"
        : frro.errors.join("; "),
    );
  } else if (guest?.corporateGstin) {
    push(
      "corporate",
      "Corporate GSTIN valid",
      isValidGSTIN(guest.corporateGstin),
      isValidGSTIN(guest.corporateGstin)
        ? `B2B invoice to ${guest.corporateName || guest.corporateGstin}`
        : `Invalid GSTIN ${guest.corporateGstin}`,
    );
  } else {
    push(
      "corporate",
      "Corporate GSTIN valid",
      true,
      "Personal stay — no corporate GSTIN required",
      false,
    );
  }

  // ---------------------------------------------------------------- payment / deposit
  const grandTotal = roundCurrency(input.booking.grandTotal || 0);
  const bookedDeposit = roundCurrency(input.depositAmount ?? input.booking.paidAmount ?? 0);
  const additional = input.additionalPayment;
  const collected = roundCurrency(bookedDeposit + (additional?.amount ?? 0));

  if (additional && additional.amount > 0) {
    const compliance = validateCashCompliance(
      additional.amount,
      additional.panNumber,
    );
    push(
      "paymentCompliance",
      "Payment instrument compliant",
      compliance.isValid,
      compliance.isValid
        ? `${additional.method ?? "Payment"} of ₹${roundCurrency(additional.amount).toLocaleString("en-IN")} accepted`
        : compliance.errors.join("; "),
    );
  }

  const depositRequired = roundCurrency(Math.max(0, grandTotal - collected));
  const depositOk = additional ? additional.amount > 0 : true;

  push(
    "deposit",
    "Deposit / payment confirmed",
    depositOk,
    additional
      ? `Collected ₹${roundCurrency(additional.amount).toLocaleString("en-IN")} against a balance of ₹${depositRequired.toLocaleString("en-IN")}`
      : `Advance on file ₹${collected.toLocaleString("en-IN")} • balance ₹${depositRequired.toLocaleString("en-IN")}`,
    depositOk,
  );

  if (additional && additional.amount > grandTotal - bookedDeposit + 0.01) {
    warnings.push(
      "Payment exceeds the outstanding balance and will be treated as an overpayment",
    );
  }

  return finalise(input, errors, warnings, checks, grandTotal, collected, depositRequired);
}

function finalise(
  input: CheckInValidationInput,
  errors: string[],
  warnings: string[],
  checks: CheckInValidationCheck[],
  grandTotal = 0,
  depositCollected = 0,
  depositBalance = 0,
): CheckInValidationResult {
  return {
    bookingId: input.bookingId,
    isValid: errors.length === 0,
    errors,
    warnings,
    checks,
    roomCharges: roundCurrency(input.roomCharges ?? 0),
    taxAmount: roundCurrency(input.taxAmount ?? 0),
    grandTotal,
    depositRequired: depositBalance,
    depositCollected,
    depositBalance,
  };
}
