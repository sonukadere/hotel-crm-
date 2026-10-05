/**
 * Reusable Indian GST & Hospitality Compliance TypeScript Interfaces
 */

export interface GSTBreakdown {
  taxableAmount: number;
  gstRate: number; // e.g. 0.12 or 0.18
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  grandTotal: number;
  totalWithTax: number;
  sacCode: string;
  isInterState: boolean;
  placeOfSupply: string;
}

export interface GSTTransaction {
  id: string;
  folioId: string;
  folioItemId?: string;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  sacCode: string;
  placeOfSupply: string;
  createdAt: string;
}

export interface CorporateGSTDetails {
  gstin: string;
  companyName: string;
  companyAddress?: string;
  stateCode?: string;
}

export interface InternationalGuestDetails {
  passportNumber: string;
  visaNumber: string;
  visaExpiry: string;
  nationality: string;
  arrivalDate: string;
  departureDate: string;
  arrivalPort: string;
}

export interface ComplianceValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiresPan: boolean;
  exceedsCashLimit: boolean;
}
