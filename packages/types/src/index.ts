/**
 * INDIAN HOTEL PMS & CRM - SHARED TYPES
 * All domain types shared across Backend, CRM Admin, and Public Booking Portal
 */

// -------------------------------------------------------------
// CORE ENUMS & LITERAL TYPES
// -------------------------------------------------------------

export type RoomStatus =
  | "Available"
  | "Clean"
  | "Dirty"
  | "Occupied"
  | "Blocked"
  | "Maintenance";

export type BookingStatus =
  | "Inquiry"
  | "Tentative"
  | "Confirmed"
  | "CheckedIn"
  | "CheckedOut"
  | "Cancelled"
  | "NoShow";

export type PaymentMethod =
  | "Cash"
  | "UPI"
  | "Card"
  | "Razorpay"
  | "Bank Transfer"
  | "Other";

export type PaymentStatus =
  | "Pending"
  | "Authorized"
  | "Captured"
  | "Failed"
  | "Refunded"
  | "PartiallyRefunded";

export type MealPlan = "EP" | "CP" | "MAP" | "AP";

export type IdentityType =
  | "Aadhaar"
  | "PAN"
  | "Passport"
  | "VoterID"
  | "DrivingLicense";

export type GuestType = "Domestic" | "International" | "Corporate";

export type LoyaltyTier = "Bronze" | "Silver" | "Gold";

export type LoyaltyTransactionType =
  | "Earn"
  | "Redeem"
  | "Expire"
  | "Adjustment"
  | "Reversal";

export type RoomOperationalState = RoomStatus | "OutOfService";

export type FolioItemType =
  | "Room"
  | "Food"
  | "Restaurant"
  | "InRoomDining"
  | "Laundry"
  | "Spa"
  | "Housekeeping"
  | "Banquet"
  | "OtherService"
  | "Discount";

export type LeadStatus =
  | "New"
  | "Contacted"
  | "Qualified"
  | "Converted"
  | "Lost";

export type NightAuditStatus = "Pending" | "Running" | "Completed" | "Failed";

export type UserRole = "SuperAdmin" | "Admin" | "Manager" | "FrontDesk" | "Housekeeping" | "Accountant";

// -------------------------------------------------------------
// GST & COMPLIANCE INTERFACES
// -------------------------------------------------------------

export interface GSTBreakdown {
  taxableAmount: number;
  gstRate: number; // e.g. 0.12 or 0.18
  cgstRate: number; // e.g. 0.06 or 0.09
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
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

/**
 * Indian accommodation GST is declared per unit per day, so a multi-night stay can
 * legitimately straddle the 12% / 18% tariff slabs. `NightlyGSTSlab` groups the
 * nights that attract the same rate so the aggregate breakdown stays auditable.
 */
export interface NightlyGSTSlab {
  gstRate: number;
  nightCount: number;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
}

export interface CorporateGSTDetails {
  gstin: string;
  companyName: string;
  companyAddress: string;
  stateCode: string;
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

// -------------------------------------------------------------
// RATE CALCULATION TYPES
// -------------------------------------------------------------

export interface NightlyRateBreakdown {
  date: string;
  dayOfWeek: string;
  isWeekend: boolean;
  basePlanRate: number;
  seasonalMultiplier: number;
  weekendMultiplier: number;
  roomBaseNightly: number;
  extraAdultCharges: number;
  extraChildCharges: number;
  mealPlanCharges: number;
  discountPerNight: number;
  effectiveNightlyRate: number;
}

export interface RateCalculationInput {
  basePlanRate: number;
  seasonalMultiplier?: number;
  weekendMultiplier?: number;
  extraAdults?: number;
  extraChildren?: number;
  extraAdultRatePerNight?: number;
  extraChildRatePerNight?: number;
  checkInDate: string;
  checkOutDate: string;
  mealPlan?: MealPlan;
  mealPlanRatePerPersonPerNight?: number;
  adultCount?: number;
  childCount?: number;
  discountPercent?: number;
  discountFlat?: number;
}

export interface RateCalculationResult {
  nights: NightlyRateBreakdown[];
  totalNights: number;
  roomSubtotal: number;
  extraGuestCharges: number;
  mealPlanCharges: number;
  totalDiscount: number;
  taxableAmount: number;
}

// -------------------------------------------------------------
// CORE ENTITIES & DTOs
// -------------------------------------------------------------

export interface Hotel {
  id: string;
  name: string;
  code: string;
  gstin: string;
  stateCode: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  website?: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface Floor {
  id: string;
  hotelId: string;
  floorNumber: number;
  name: string;
  description?: string;
  rooms?: Room[];
}

export interface BedType {
  id: string;
  name: string; // King, Queen, Twin, Single, Sofa Bed
  capacity: number;
  rooms?: Room[];
}

export interface RoomType {
  id: string;
  hotelId: string;
  name: string; // Standard, Deluxe, Suite, Premium, Family
  code: string;
  description?: string;
  basePrice: number;
  maxAdults: number;
  maxChildren: number;
  baseAdults: number;
  amenities: string[];
  images: string[];
  isActive: boolean;
  ratePlans?: RatePlan[];
  roomsCount?: number;
}

export interface Room {
  id: string;
  hotelId: string;
  roomNumber: string;
  floorId: string;
  roomTypeId: string;
  bedTypeId?: string;
  status: RoomStatus;
  isActive: boolean;
  baseRate?: number;
  floor?: Floor;
  roomType?: RoomType;
  bedType?: BedType;
  bookings?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RatePlan {
  id: string;
  hotelId: string;
  roomTypeId: string;
  name: string;
  code: string;
  mealPlan: MealPlan;
  baseRate: number;
  seasonalMultiplier: number;
  weekendMultiplier: number;
  extraAdultRate: number;
  extraChildRate: number;
  isActive: boolean;
  roomType?: RoomType;
}

export interface GuestIdentity {
  id: string;
  guestId: string;
  identityType: IdentityType;
  idNumber: string;
  maskedIdNumber: string;
  verified: boolean;
  issuedCountry?: string;
  expiryDate?: string;
  documentImageUrl?: string;
}

export interface Guest {
  id: string;
  hotelId?: string;
  fullName: string;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  stateCode?: string;
  state?: string;
  country: string;
  guestType: GuestType;
  corporateGstin?: string;
  corporateName?: string;
  identities?: GuestIdentity[];
  internationalDetails?: InternationalGuestDetails;
  loyaltyAccountId?: string;
  preferences?: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingGuest {
  id: string;
  bookingId: string;
  guestId: string;
  isPrimary: boolean;
  guest?: Guest;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  hotelId: string;
  roomId?: string;
  roomTypeId: string;
  ratePlanId: string;
  primaryGuestId: string;
  checkInDate: string;
  checkOutDate: string;
  actualCheckIn?: string;
  actualCheckOut?: string;
  adults: number;
  children: number;
  mealPlan: MealPlan;
  status: BookingStatus;
  bookingSource: string; // Direct, Phone, OTA, Corporate, WalkIn
  specialRequests?: string;
  totalNights: number;
  roomCharges: number;
  extraCharges: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  primaryGuest?: Guest;
  room?: Room;
  roomType?: RoomType;
  ratePlan?: RatePlan;
  folio?: Folio;
  createdAt: string;
  updatedAt: string;
}

export interface FolioItem {
  id: string;
  folioId: string;
  itemType: FolioItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sacCode: string;
  gstRate: number;
  gstAmount: number;
  isVoided: boolean;
  voidReason?: string;
  postedAt: string;
  splitTarget?: "Corporate" | "Personal";
}

export interface Folio {
  id: string;
  folioNumber: string;
  bookingId: string;
  guestId: string;
  hotelId: string;
  status: "Open" | "Closed" | "Settled";
  items: FolioItem[];
  payments: Payment[];
  gstTransactions: GSTTransaction[];
  totalDebit: number;
  totalCredit: number;
  balanceDue: number;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  folioId: string;
  bookingId?: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionRef?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  panNumber?: string;
  notes?: string;
  receivedAt: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  hotelId: string;
  hotel: Hotel;
  guest: Guest;
  booking: Booking;
  items: FolioItem[];
  gstBreakdown: GSTBreakdown;
  taxableAmount: number;
  totalTax: number;
  grandTotal: number;
  amountInWords: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
}

export interface LoyaltyAccount {
  id: string;
  guestId: string;
  tier: LoyaltyTier;
  availablePoints: number;
  lifetimePoints: number;
  redeemedPoints: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyTransaction {
  id: string;
  loyaltyAccountId: string;
  type: LoyaltyTransactionType;
  points: number;
  referenceFolioId?: string;
  notes?: string;
  createdAt: string;
}

export interface CRMLead {
  id: string;
  hotelId: string;
  guestName: string;
  mobile: string;
  email?: string;
  source: string;
  requirement?: string;
  expectedCheckIn?: string;
  expectedCheckOut?: string;
  guestCount?: number;
  status: LeadStatus;
  notes?: string;
  convertedBookingId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NightAuditReport {
  id: string;
  hotelId: string;
  businessDate: string;
  startedAt: string;
  completedAt?: string;
  auditorUserId: string;
  status: NightAuditStatus;
  chargesPosted: number;
  paymentsPosted: number;
  roomRevenue: number;
  serviceRevenue: number;
  taxCollected: number;
  cashCollected: number;
  cardCollected: number;
  upiCollected: number;
  razorpayCollected: number;
  occupiedRooms: number;
  totalAvailableRooms: number;
  occupancyRate: number;
  adr: number;
  revPar: number;
  errors?: string[];
  logs?: string[];
}

export interface FlashReport {
  id: string;
  hotelId: string;
  hotelName: string;
  businessDate: string;
  nextBusinessDate: string;
  closedAt: string;
  auditedBy: string;

  // Key Performance Indicators (Statutory PMS calculations)
  totalAvailableRooms: number;
  occupiedRooms: number;
  occupancyRate: number; // occupiedRooms / totalAvailableRooms * 100
  adr: number;           // totalRoomRevenue / occupiedRooms
  revPar: number;        // totalRoomRevenue / totalAvailableRooms

  // Financial Breakdown (INR)
  totalRoomRevenue: number;
  totalServiceRevenue: number;
  totalRevenue: number;
  taxCollected: number;
  cgstCollected: number;
  sgstCollected: number;
  igstCollected: number;
  outstandingBalance: number;

  // Payments Collection Reconciliations
  cashCollection: number;
  cardCollection: number;
  upiCollection: number;
  razorpayCollection: number;
  totalCollection: number;

  // Front Office Movements
  checkIns: number;
  checkOuts: number;
  noShows: number;
  cancellations: number;

  chargesPostedCount: number;
  paymentsPostedCount: number;
}

export interface PreAuditChecklist {
  businessDate: string;
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  checkedInBookingsCount: number;
  pendingArrivalsCount: number;
  pendingDeparturesCount: number;
  unpostedRoomTariffsCount: number;
  openFoliosCount: number;
  isReadyForAudit: boolean;
  warnings: string[];
}

export interface HotelPerformanceMetrics {
  businessDate: string;
  occupiedRooms: number;
  totalAvailableRooms: number;
  occupancyRate: number; // %
  adr: number; // Average Daily Rate in INR
  revPar: number; // Revenue Per Available Room in INR
  totalRoomRevenue: number;
  totalServiceRevenue: number;
  totalRevenue: number;
  taxCollected: number;
  outstandingBalance: number;
  arrivalsToday: number;
  departuresToday: number;
  noShowsToday: number;
  cancellationsToday: number;
}

export interface AuditLogEntry {
  id: string;
  hotelId?: string;
  userId?: string;
  userEmail?: string;
  action: string;
  entity: string;
  entityId: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

// -------------------------------------------------------------
// MODULE 6 — FRONT DESK PMS / RESERVATION
// -------------------------------------------------------------

/**
 * Front-desk facing payment state, derived from folio credit vs debit.
 * Distinct from `PaymentStatus` which describes an individual payment instrument leg.
 */
export type FrontDeskPaymentStatus = "Unpaid" | "Partially Paid" | "Paid" | "Refunded";

export interface TapeChartGuest {
  id: string;
  fullName: string;
  mobile: string;
  guestType: GuestType;
  isCorporate: boolean;
  corporateName?: string;
}

export interface TapeChartStay {
  bookingId: string;
  bookingNumber: string;
  bookingStatus: BookingStatus;
  guest: TapeChartGuest;
  roomTypeName: string;
  ratePlanName: string;
  mealPlan: MealPlan;
  checkInDate: string;
  checkOutDate: string;
  /** Stay clipped to the visible tape-chart window so bars never overflow the grid. */
  windowCheckInDate: string;
  windowCheckOutDate: string;
  totalNights: number;
  adults: number;
  children: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  depositAmount: number;
  paymentStatus: FrontDeskPaymentStatus;
  isArrival: boolean;
  isDeparture: boolean;
  isInHouse: boolean;
  specialRequests?: string;
}

export interface TapeChartRoom {
  id: string;
  roomNumber: string;
  floorId: string;
  floorNumber: number;
  roomTypeId: string;
  roomTypeName: string;
  bedTypeName?: string;
  status: RoomStatus;
  isActive: boolean;
  baseRate: number;
  maxAdults: number;
  maxChildren: number;
  /** False when the room cannot be sold at all (inactive, blocked or under maintenance). */
  isSellable: boolean;
  unavailableReason?: string;
  /** Stay physically in the room right now, regardless of the visible window. */
  currentStay?: TapeChartStay;
  /** Arriving reservations intersecting the visible window, in arrival order. */
  stays: TapeChartStay[];
}

export interface TapeChartDay {
  date: string;
  dayOfWeek: string;
  dayOfMonth: number;
  isWeekend: boolean;
  isToday: boolean;
  arrivals: number;
  departures: number;
  occupied: number;
  occupancyPct: number;
}

export interface TapeChartSummary {
  totalRooms: number;
  sellableRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  cleanRooms: number;
  dirtyRooms: number;
  blockedRooms: number;
  maintenanceRooms: number;
  occupancyPct: number;
  adr: number;
  revPar: number;
  arrivals: number;
  departures: number;
  inHouseGuests: number;
  roomRevenue: number;
}

export interface TapeChartResponse {
  hotelId: string;
  fromDate: string;
  toDate: string;
  days: TapeChartDay[];
  rooms: TapeChartRoom[];
  summary: TapeChartSummary;
  generatedAt: string;
}

export interface AvailabilityConflict {
  bookingId: string;
  bookingNumber: string;
  bookingStatus: BookingStatus;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
}

export interface AvailabilityResult {
  roomId: string;
  roomNumber: string;
  floorNumber: number;
  roomTypeId: string;
  roomTypeName: string;
  status: RoomStatus;
  baseRate: number;
  maxAdults: number;
  maxChildren: number;
  isSellable: boolean;
  unavailableReason?: string;
  conflicts: AvailabilityConflict[];
}

export interface RoomAvailabilityResponse {
  checkInDate: string;
  checkOutDate: string;
  totalNights: number;
  rooms: AvailabilityResult[];
  sellableCount: number;
}

export interface ReservationQuoteInput {
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children?: number;
  mealPlan?: MealPlan;
  mealPlanRatePerPersonPerNight?: number;
  discountPercent?: number;
  discountFlat?: number;
  advanceDeposit?: number;
  hotelStateCode: string;
  guestStateCode?: string;
  baseAdults?: number;
  maxAdults?: number;
  maxChildren?: number;
  ratePlan: {
    baseRate: number;
    seasonalMultiplier?: number;
    weekendMultiplier?: number;
    extraAdultRate?: number;
    extraChildRate?: number;
    mealPlan?: MealPlan;
    code?: string;
    name?: string;
  };
}

export interface QuoteLine {
  key: string;
  label: string;
  amount: number;
  kind: "charge" | "discount" | "tax" | "total";
}

export interface ReservationQuote {
  totalNights: number;
  nights: NightlyRateBreakdown[];
  nightsPerSlab: NightlyGSTSlab[];
  roomCharges: number;
  extraCharges: number;
  mealPlanCharges: number;
  discountAmount: number;
  taxableAmount: number;
  gst: GSTBreakdown;
  grandTotal: number;
  advanceDeposit: number;
  balanceDue: number;
  amountInWords: string;
  lines: QuoteLine[];
  errors: string[];
  warnings: string[];
}

export interface CheckInValidationCheck {
  key: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  message: string;
}

export interface CheckInValidationResult {
  bookingId: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checks: CheckInValidationCheck[];
  roomCharges: number;
  taxAmount: number;
  grandTotal: number;
  depositRequired: number;
  depositCollected: number;
  depositBalance: number;
}

export interface CheckoutPaymentLine {
  paymentId: string;
  paymentNumber: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  receivedAt: string;
  panNumber?: string;
  notes?: string;
}

export interface CheckoutGstLine {
  sacCode: string;
  description: string;
  taxableAmount: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  placeOfSupply: string;
}

export interface CheckoutSummary {
  bookingId: string;
  bookingNumber: string;
  folioId: string;
  folioNumber: string;
  folioStatus: string;
  guestName: string;
  mobile: string;
  roomId?: string;
  roomNumber?: string;
  checkInDate: string;
  checkOutDate: string;
  actualCheckIn?: string;
  actualCheckOut?: string;
  totalNights: number;
  roomCharges: number;
  serviceCharges: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  totalDebit: number;
  totalCredit: number;
  advanceDeposit: number;
  balanceDue: number;
  isSettled: boolean;
  paymentStatus: FrontDeskPaymentStatus;
  amountInWords: string;
  gstLines: CheckoutGstLine[];
  payments: CheckoutPaymentLine[];
}

export interface RoomSwitchRequest {
  bookingId: string;
  newRoomId: string;
  reason: string;
  recalculateRate?: boolean;
  userId?: string;
}

export interface RoomSwitchResult {
  bookingId: string;
  bookingNumber: string;
  previousRoomId?: string;
  previousRoomNumber?: string;
  newRoomId: string;
  newRoomNumber: string;
  newRoomTypeName: string;
  previousRoomStatus: RoomStatus;
  newRoomStatus: RoomStatus;
  rateRecalculated: boolean;
  previousNightlyRate: number;
  newNightlyRate: number;
  remainingNights: number;
  rateDifference: number;
  adjustmentAmount: number;
  grandTotal: number;
  balanceDue: number;
  quote?: ReservationQuote;
  auditAction: string;
}

export interface RoomStateTransitionResult {
  roomId: string;
  roomNumber: string;
  previousStatus: RoomStatus;
  status: RoomStatus;
  allowedNextStates: RoomStatus[];
}

export interface FrontDeskDashboardSummary {
  hotelId: string;
  businessDate: string;
  occupancyPct: number;
  occupiedRooms: number;
  sellableRooms: number;
  arrivals: number;
  departures: number;
  inHouse: number;
  dirtyRooms: number;
  maintenanceRooms: number;
  roomRevenue: number;
  advanceDepositsHeld: number;
  outstandingBalance: number;
}

// -------------------------------------------------------------
// API ENVELOPES & RESPONSES
// -------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: string[];
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}
