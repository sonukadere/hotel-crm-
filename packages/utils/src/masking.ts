/**
 * Indian Identity Masking & Compliance Utilities
 */

export function maskAadhaar(aadhaar: string): string {
  const cleaned = aadhaar.replace(/[^0-9]/g, "");
  if (cleaned.length !== 12) {
    return "XXXX-XXXX-XXXX";
  }
  const lastFour = cleaned.slice(-4);
  return `XXXX-XXXX-${lastFour}`;
}

export function isValidAadhaar(aadhaar: string): boolean {
  const cleaned = aadhaar.replace(/[^0-9]/g, "");
  return cleaned.length === 12;
}

export function isValidPAN(pan: string): boolean {
  const cleanPAN = pan.trim().toUpperCase();
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(cleanPAN);
}

export function isValidIndianMobile(mobile: string): boolean {
  const cleaned = mobile.replace(/[^0-9]/g, "");
  // Matches 10 digit Indian mobiles or with +91 prefix
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return /^[6-9]\d{9}$/.test(cleaned.slice(2));
  }
  return /^[6-9]\d{9}$/.test(cleaned);
}

export function cleanIndianMobile(mobile: string): string {
  const cleaned = mobile.replace(/[^0-9]/g, "");
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return cleaned.slice(2);
  }
  return cleaned;
}

export function maskIdentity(idType: string, idNumber: string): string {
  if (idType.toLowerCase() === "aadhaar") {
    return maskAadhaar(idNumber);
  }
  if (idNumber.length <= 4) {
    return "****";
  }
  const visible = idNumber.slice(-4);
  return "*".repeat(idNumber.length - 4) + visible;
}
