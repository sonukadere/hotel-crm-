import type { RoomStatus } from "@hotel/types";
import { doDateRangesOverlap } from "./dateRanges";
import { isOutOfServiceRoomState } from "./roomStates";

/**
 * Booking statuses that hold inventory. An `Inquiry` is a lead, not inventory;
 * `Cancelled` and `NoShow` release the room back to the grid.
 */
export const INVENTORY_HOLDING_BOOKING_STATUSES = [
  "Tentative",
  "Confirmed",
  "CheckedIn",
] as const;

export function isInventoryHoldingStatus(status: string): boolean {
  return (INVENTORY_HOLDING_BOOKING_STATUSES as readonly string[]).includes(status);
}

export interface AvailabilityCandidateBooking {
  id: string;
  bookingNumber: string;
  status: string;
  checkInDate: string | Date;
  checkOutDate: string | Date;
  guestName?: string;
}

export interface AvailabilityCandidateRoom {
  id: string;
  roomNumber: string;
  status: RoomStatus;
  isActive?: boolean;
}

/**
 * Pure availability evaluation: is this room sellable for the requested range?
 *
 * Three independent gates must all pass:
 *  1. the room is active and operationally sellable (not Blocked / Maintenance)
 *  2. the room is not physically occupied right now
 *  3. no other inventory-holding booking overlaps the requested nights
 *
 * Gate 3 is what guarantees two active bookings can never occupy the same room.
 */
export function evaluateRoomAvailability(params: {
  room: AvailabilityCandidateRoom;
  bookings: AvailabilityCandidateBooking[];
  checkInDate: string | Date;
  checkOutDate: string | Date;
  excludeBookingId?: string;
}): { isSellable: boolean; reason?: string; conflicts: AvailabilityCandidateBooking[] } {
  const { room, bookings, excludeBookingId } = params;

  if (room.isActive === false) {
    return {
      isSellable: false,
      reason: `Room ${room.roomNumber} is deactivated`,
      conflicts: [],
    };
  }

  if (isOutOfServiceRoomState(room.status)) {
    return {
      isSellable: false,
      reason: `Room ${room.roomNumber} is ${room.status}`,
      conflicts: [],
    };
  }

  if (room.status === "Occupied") {
    return {
      isSellable: false,
      reason: `Room ${room.roomNumber} is currently occupied`,
      conflicts: [],
    };
  }

  const conflicts = bookings.filter(
    (b) =>
      b.id !== excludeBookingId &&
      isInventoryHoldingStatus(b.status) &&
      doDateRangesOverlap(
        { start: params.checkInDate, end: params.checkOutDate },
        { start: b.checkInDate, end: b.checkOutDate },
      ),
  );

  if (conflicts.length > 0) {
    const numbers = conflicts.map((c) => c.bookingNumber).join(", ");
    return {
      isSellable: false,
      reason: `Room ${room.roomNumber} already has ${conflicts.length} overlapping booking(s): ${numbers}`,
      conflicts,
    };
  }

  return { isSellable: true, conflicts: [] };
}

/**
 * Finds every booking that would clash with the requested range on a room.
 * Used by both the reservation flow and the room switch flow so the two can
 * never disagree about what "free" means.
 */
export function findConflictingBookings(params: {
  bookings: AvailabilityCandidateBooking[];
  checkInDate: string | Date;
  checkOutDate: string | Date;
  excludeBookingId?: string;
}): AvailabilityCandidateBooking[] {
  return params.bookings.filter(
    (b) =>
      b.id !== params.excludeBookingId &&
      isInventoryHoldingStatus(b.status) &&
      doDateRangesOverlap(
        { start: params.checkInDate, end: params.checkOutDate },
        { start: b.checkInDate, end: b.checkOutDate },
      ),
  );
}
