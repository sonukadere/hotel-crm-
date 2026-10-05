/**
 * INDIAN HOSPITALITY CONSTANTS & CONFIGURATION
 */

export const INDIAN_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman & Diu",
  "26": "Dadra & Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh (New)",
  "38": "Ladakh",
  "97": "Other Territory",
};

export const SAC_CODES = {
  ROOM_ACCOMMODATION: "996311",
  RESTAURANT_DINING: "996331",
  LAUNDRY_HOUSEKEEPING: "999799",
  BANQUET_EVENT_SPACES: "997212",
  SPA_WELLNESS: "999721",
  BUSINESS_SERVICES: "998311",
} as const;

export const GST_CONFIG = {
  ROOM_THRESHOLD_INR: 7500,
  ROOM_RATE_BELOW_OR_EQUAL_THRESHOLD: 0.12, // 12% for <= 7500
  ROOM_RATE_ABOVE_THRESHOLD: 0.18,          // 18% for > 7500
  FOOD_RESTAURANT_RATE: 0.05,               // 5% standard standalone / non-luxury, or 18% for 5-star
  FOOD_IN_ROOM_DINING_RATE: 0.05,
  SERVICES_STANDARD_RATE: 0.18,             // 18% for laundry, banquet, events, spa
  CASH_LIMIT_THRESHOLD: 200000,             // ₹2,00,000 Section 269ST limit
  PAN_CASH_THRESHOLD: 50000,                // ₹50,000 PAN mandate for cash
};

export const MEAL_PLANS = {
  EP: { code: "EP", name: "European Plan", description: "Room Only (No Meals)" },
  CP: { code: "CP", name: "Continental Plan", description: "Room with Breakfast" },
  MAP: { code: "MAP", name: "Modified American Plan", description: "Room + Breakfast + Lunch or Dinner" },
  AP: { code: "AP", name: "American Plan", description: "Room + All 3 Meals (Breakfast, Lunch, Dinner)" },
} as const;

export const LOYALTY_CONFIG = {
  TIERS: {
    Bronze: { minSpend: 0, pointsPer100Inr: 5, redemptionRateInr: 0.5 },
    Silver: { minSpend: 50000, pointsPer100Inr: 8, redemptionRateInr: 0.6 },
    Gold: { minSpend: 150000, pointsPer100Inr: 12, redemptionRateInr: 0.75 },
  },
  POINTS_EXPIRY_MONTHS: 24,
};

export const DEFAULT_HOTEL_INFO = {
  name: "Grand Rajwada Palace & Suites",
  code: "GRP-01",
  gstin: "27AAAAA0000A1Z5",
  stateCode: "27",
  address: "Heritage Marg, Civil Lines",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  phone: "+91 22 2345 6789",
  email: "reservations@grandrajwada.com",
  checkInTime: "14:00",
  checkOutTime: "11:00",
};
