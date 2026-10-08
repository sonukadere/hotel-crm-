/**
 * Hotel Performance Metrics & Key Performance Indicators (KPIs)
 * Implements Statutory Indian Hospitality PMS Formulas:
 *
 * 1. occupancyRate = (occupiedRooms / totalAvailableRooms) * 100
 * 2. ADR (Average Daily Rate) = totalRoomRevenueINR / occupiedRooms
 * 3. RevPAR (Revenue Per Available Room) = totalRoomRevenueINR / totalAvailableRooms
 */

export interface HotelPerformanceInput {
  occupiedRooms: number;
  totalAvailableRooms: number;
  totalRoomRevenueINR: number;
  totalServiceRevenueINR?: number;
  taxCollectedINR?: number;
  outstandingBalanceINR?: number;
  arrivalsToday?: number;
  departuresToday?: number;
  noShowsToday?: number;
  cancellationsToday?: number;
}

export interface HotelPerformanceKPIs {
  occupiedRooms: number;
  totalAvailableRooms: number;
  occupancyRate: number; // percentage 0–100 rounded to 2 decimals or whole %
  adr: number; // Average Daily Rate in ₹
  revPar: number; // Revenue Per Available Room in ₹
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

/**
 * Calculates occupancy rate percentage.
 * Formula: occupancyRate = occupiedRooms / totalAvailableRooms * 100
 */
export function calculateOccupancyRate(
  occupiedRooms: number,
  totalAvailableRooms: number,
): number {
  if (totalAvailableRooms <= 0 || occupiedRooms <= 0) {
    return 0;
  }
  const rate = (occupiedRooms / totalAvailableRooms) * 100;
  return Math.min(100, Math.round(rate * 100) / 100);
}

/**
 * Calculates Average Daily Rate (ADR).
 * Formula: ADR = totalRoomRevenueINR / occupiedRooms
 */
export function calculateADR(
  totalRoomRevenueINR: number,
  occupiedRooms: number,
): number {
  if (occupiedRooms <= 0 || totalRoomRevenueINR <= 0) {
    return 0;
  }
  return Math.round((totalRoomRevenueINR / occupiedRooms) * 100) / 100;
}

/**
 * Calculates Revenue Per Available Room (RevPAR).
 * Formula: RevPAR = totalRoomRevenueINR / totalAvailableRooms
 *
 * Mathematical Identity:
 * RevPAR === ADR * (occupancyRate / 100)
 */
export function calculateRevPAR(
  totalRoomRevenueINR: number,
  totalAvailableRooms: number,
): number {
  if (totalAvailableRooms <= 0 || totalRoomRevenueINR <= 0) {
    return 0;
  }
  return Math.round((totalRoomRevenueINR / totalAvailableRooms) * 100) / 100;
}

/**
 * Computes all operational and statutory KPIs for the hotel.
 */
export function calculateHotelPerformanceKPIs(
  input: HotelPerformanceInput,
): HotelPerformanceKPIs {
  const safeAvailable = Math.max(0, input.totalAvailableRooms);
  const safeOccupied = Math.max(0, input.occupiedRooms);
  const safeRoomRev = Math.max(0, input.totalRoomRevenueINR);
  const safeServiceRev = Math.max(0, input.totalServiceRevenueINR ?? 0);

  const occupancyRate = calculateOccupancyRate(safeOccupied, safeAvailable);
  const adr = calculateADR(safeRoomRev, safeOccupied);
  const revPar = calculateRevPAR(safeRoomRev, safeAvailable);

  return {
    occupiedRooms: safeOccupied,
    totalAvailableRooms: safeAvailable,
    occupancyRate,
    adr,
    revPar,
    totalRoomRevenue: safeRoomRev,
    totalServiceRevenue: safeServiceRev,
    totalRevenue: safeRoomRev + safeServiceRev,
    taxCollected: Math.max(0, input.taxCollectedINR ?? 0),
    outstandingBalance: input.outstandingBalanceINR ?? 0,
    arrivalsToday: input.arrivalsToday ?? 0,
    departuresToday: input.departuresToday ?? 0,
    noShowsToday: input.noShowsToday ?? 0,
    cancellationsToday: input.cancellationsToday ?? 0,
  };
}
