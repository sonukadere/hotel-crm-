export type MealPlanCode = "EP" | "CP" | "MAP" | "AP";

export interface PublicHotel {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  gstin: string;
  stateCode: string;
  checkInTime: string;
  checkOutTime: string;
  currency: string;
}

export interface PublicRatePlan {
  ratePlanId: string;
  code: string;
  name: string;
  mealPlan: MealPlanCode;
  basePrice: number;
  seasonalMultiplier: number;
  weekendMultiplier: number;
  extraAdultRate: number;
  extraChildRate: number;
}

export interface PublicRoomType {
  roomTypeId: string;
  code: string;
  name: string;
  description: string | null;
  images: string[];
  amenities: string[];
  basePrice: number;
  occupancy: { baseAdults: number; maxAdults: number; maxChildren: number };
  totalRooms: number;
  sellableRooms?: number;
  mealPlans: MealPlanCode[];
  ratePlans: PublicRatePlan[];
}

export interface PublicService {
  serviceId: string;
  code: string;
  name: string;
  category: string;
  sacCode: string;
  basePrice: number;
  gstRate: number;
}

export interface QuoteLine {
  key: string;
  label: string;
  amount: number;
  kind: "charge" | "discount" | "tax" | "total";
}

export interface PublicServiceLine {
  serviceId: string;
  code: string;
  name: string;
  category: string;
  itemType: string;
  sacCode: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  total: number;
}

export interface PublicGstBreakdown {
  total: number;
  placeOfSupply: string;
  isInterState: boolean;
  sacCode: string;
  room: { cgst: number; sgst: number; igst: number; gstRate: number };
  services: { cgst: number; sgst: number; igst: number; gstRate: number };
}

export interface PublicPriceSummary {
  roomSubtotal: number;
  services: number;
  discount: number;
  gst: number;
  finalAmount: number;
  amountInWords: string;
}

export interface PublicQuote {
  rooms: number;
  nights: number;
  mealPlan: MealPlanCode;
  services: PublicServiceLine[];
  gst: PublicGstBreakdown;
  summary: PublicPriceSummary;
  lines: QuoteLine[];
  warnings: string[];
}

export interface PublicOffer {
  ratePlanId: string;
  ratePlanCode: string;
  ratePlanName: string;
  mealPlan: MealPlanCode;
  matchesRequestedMealPlan: boolean;
  basePrice: number;
  seasonalMultiplier: number;
  weekendMultiplier: number;
  quote: PublicQuote | null;
  errors: string[];
}

export interface PublicRoomResult {
  roomTypeId: string;
  code: string;
  name: string;
  description: string | null;
  images: string[];
  amenities: string[];
  basePrice: number;
  occupancy: { baseAdults: number; maxAdults: number; maxChildren: number };
  totalRooms: number;
  availableRooms: number;
  roomsRequested: number;
  isAvailable: boolean;
  isOccupancyOk: boolean;
  mealPlan: MealPlanCode;
  availableMealPlans: MealPlanCode[];
  offers: PublicOffer[];
}

export interface PublicSearchResponse {
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number;
  children: number;
  roomsRequested: number;
  mealPlan: MealPlanCode | null;
  guestStateCode: string;
  results: PublicRoomResult[];
  availableRoomTypes: number;
}

export interface QuoteResponse {
  roomTypeId: string;
  roomType: { code: string; name: string };
  ratePlan: { id: string; code: string; name: string };
  hotelId: string;
  guestStateCode: string;
  checkInDate: string;
  checkOutDate: string;
  occupancy: { baseAdults: number; maxAdults: number; maxChildren: number };
  quote: PublicQuote;
}

export interface RazorpayOrder {
  orderId: string;
  amount: number;
  amountINR: number;
  currency: string;
  keyId: string;
  demo: boolean;
}

export interface CheckoutResponse {
  order: RazorpayOrder;
  quote: PublicQuote;
  token: string;
  selection: {
    roomTypeId: string;
    roomType: { code: string; name: string };
    ratePlan: { id: string; code: string; name: string };
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    adults: number;
    children: number;
    rooms: number;
    mealPlan: MealPlanCode;
    guestStateCode: string;
  };
}

export interface BookingConfirmation {
  bookingNumbers: string[];
  primaryBookingNumber: string;
  status: string;
  hotel: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email: string;
    gstin: string | null;
    stateCode: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
  };
  guest: {
    fullName: string;
    mobile: string;
    email: string | null;
    state: string | null;
    stateCode: string | null;
    address: string | null;
    gstin: string | null;
  };
  stay: {
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    adults: number;
    children: number;
    rooms: number;
    mealPlan: MealPlanCode;
    roomType: { code: string; name: string };
    ratePlan: { code: string; name: string };
    roomNumbers: string[];
  };
  pricing: {
    roomSubtotal: number;
    services: number;
    discount: number;
    gst: number;
    finalAmount: number;
    amountInWords: string;
  };
  payment: {
    amount: number;
    method: string;
    transactionRef: string | null;
    paidAt: string;
  };
  confirmation: { sent: boolean; channel: string; sentAt: string };
  createdAt: string;
}
