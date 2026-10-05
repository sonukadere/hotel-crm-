import {
  CorporateGSTDetails,
  InternationalGuestDetails,
  ComplianceValidationResult,
} from "./gstTypes";
import { GST_CONFIG, INDIAN_STATE_CODES } from "./gstConstants";
import { isValidPAN, isValidAadhaar } from "../masking";
import type { IdentityType } from "@hotel/types";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const VOTER_ID_REGEX = /^[A-Z]{3}[0-9]{7}$/;
const PASSPORT_REGEX = /^[A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]$|^[A-Z0-9]{6,9}$/i;
const DRIVING_LICENSE_REGEX = /^[A-Z]{2}[0-9]{2}[0-9A-Z]{7,11}$/i;

/**
 * Validates a standard Indian 15-character Goods and Services Tax Identification Number (GSTIN)
 */
export function isValidGSTIN(gstin: string): boolean {
  if (!gstin) return false;
  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15) return false;
  if (!GSTIN_REGEX.test(clean)) return false;

  // Validate state code exists in list of Indian states/UTs
  const stateCode = clean.slice(0, 2);
  return Boolean(INDIAN_STATE_CODES[stateCode]);
}

/**
 * Extracts the 2-digit Indian state code from a valid GSTIN
 */
export function extractStateCodeFromGSTIN(gstin: string): string | null {
  if (!isValidGSTIN(gstin)) return null;
  return gstin.trim().toUpperCase().slice(0, 2);
}

/**
 * Validates corporate B2B GST details
 */
export function validateCorporateGST(details: Partial<CorporateGSTDetails>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!details.gstin || !isValidGSTIN(details.gstin)) {
    errors.push("Invalid 15-digit GSTIN or invalid state code prefix");
  }
  if (!details.companyName || details.companyName.trim().length < 2) {
    errors.push("Company name is required for B2B billing");
  }
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Cash compliance validator based on Indian Income Tax laws:
 * - Section 269ST: Absolute prohibition on cash receipt >= ₹2,00,000
 * - Rule 114B / Section 139A: PAN mandatory for cash transactions > ₹50,000
 */
export function validateCashCompliance(amount: number, pan?: string): ComplianceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let requiresPan = false;
  let exceedsCashLimit = false;

  if (amount >= GST_CONFIG.CASH_LIMIT_THRESHOLD) {
    exceedsCashLimit = true;
    errors.push(
      `Cash transaction of ₹${amount.toLocaleString("en-IN")} violates Section 269ST (Limit: ₹2,00,000). Electronic payment required.`,
    );
  }

  if (amount > GST_CONFIG.PAN_CASH_THRESHOLD) {
    requiresPan = true;
    if (!pan || !isValidPAN(pan)) {
      errors.push(
        `Valid PAN is legally mandatory under Rule 114B for cash payments exceeding ₹50,000.`,
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    requiresPan,
    exceedsCashLimit,
  };
}

/**
 * International guest C-Form / FRRO compliance validator
 * Captures and validates: Passport number, Visa number, Visa expiry, Nationality,
 * Arrival date, Departure date, and Arrival port.
 */
export function validateInternationalGuest(
  details: Partial<InternationalGuestDetails>,
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!details.passportNumber || details.passportNumber.trim().length < 5) {
    errors.push("Valid Passport Number is mandatory for international guests");
  }
  if (!details.nationality || details.nationality.trim().length === 0) {
    errors.push("Nationality is mandatory");
  }
  if (!details.visaNumber || details.visaNumber.trim().length === 0) {
    errors.push("Visa number is mandatory for international guests");
  }
  if (!details.visaExpiry) {
    errors.push("Visa expiry date is required");
  } else {
    const expiry = new Date(details.visaExpiry);
    if (isNaN(expiry.getTime())) {
      errors.push("Visa expiry date is invalid");
    }
  }
  if (!details.arrivalDate) {
    errors.push("Arrival date into India is required for Form C");
  }
  if (!details.departureDate) {
    errors.push("Expected departure date is required for Form C");
  }
  if (!details.arrivalPort || details.arrivalPort.trim().length === 0) {
    errors.push("Arrival Port of Entry is required for Form C");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates identity proof documents:
 * Aadhaar, PAN, Driving License, Voter ID, Passport
 */
export function validateIdentityDocument(
  idType: IdentityType,
  idNumber: string,
): { isValid: boolean; error?: string } {
  const clean = idNumber.trim();
  if (!clean) {
    return { isValid: false, error: `${idType} number cannot be empty` };
  }

  switch (idType) {
    case "Aadhaar":
      if (!isValidAadhaar(clean)) {
        return { isValid: false, error: "Aadhaar must be a 12-digit number" };
      }
      return { isValid: true };

    case "PAN":
      if (!isValidPAN(clean)) {
        return { isValid: false, error: "PAN must be 10 characters (e.g. ABCDE1234F)" };
      }
      return { isValid: true };

    case "VoterID":
      if (!VOTER_ID_REGEX.test(clean.toUpperCase())) {
        return { isValid: false, error: "Voter ID must be 3 letters followed by 7 digits" };
      }
      return { isValid: true };

    case "Passport":
      if (!PASSPORT_REGEX.test(clean)) {
        return { isValid: false, error: "Invalid Passport Number format" };
      }
      return { isValid: true };

    case "DrivingLicense":
      if (!DRIVING_LICENSE_REGEX.test(clean.replace(/[\s-]/g, ""))) {
        return { isValid: false, error: "Invalid Indian Driving License format" };
      }
      return { isValid: true };

    default:
      return { isValid: clean.length >= 4 };
  }
}
