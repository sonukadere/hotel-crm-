import type { RoomStatus } from "@hotel/types";

/**
 * Room states a reservation may legally occupy.
 * `Dirty` / `Clean` / `Available` are sellable — the front desk can sell a dirty
 * room with an early check-in, it simply needs to be flagged to housekeeping.
 */
export const SELLABLE_ROOM_STATES: readonly RoomStatus[] = [
  "Available",
  "Clean",
  "Dirty",
] as const;

/** States that take the room out of inventory entirely. */
export const OUT_OF_SERVICE_ROOM_STATES: readonly RoomStatus[] = [
  "Blocked",
  "Maintenance",
] as const;

/** States where a physical guest is currently inside the room. */
export const OCCUPIED_ROOM_STATES: readonly RoomStatus[] = ["Occupied"] as const;

/**
 * Guarded room state machine.
 *
 * Front desk and housekeeping may not manually move a room out of `Occupied`:
 * the room can only be released by a transactional check-out or room switch, so a
 * mis-click can never orphan a guest or strand an invoice.
 */
export const ROOM_STATE_TRANSITIONS: Record<RoomStatus, readonly RoomStatus[]> = {
  Available: ["Clean", "Dirty", "Blocked", "Maintenance"],
  Clean: ["Available", "Dirty", "Blocked", "Maintenance"],
  Dirty: ["Clean", "Available", "Blocked", "Maintenance"],
  Occupied: ["Dirty"],
  Blocked: ["Available", "Clean", "Maintenance"],
  Maintenance: ["Available", "Clean", "Dirty", "Blocked"],
};

export function isSellableRoomState(status: RoomStatus): boolean {
  return SELLABLE_ROOM_STATES.includes(status);
}

export function isOutOfServiceRoomState(status: RoomStatus): boolean {
  return OUT_OF_SERVICE_ROOM_STATES.includes(status);
}

export function isOccupiedRoomState(status: RoomStatus): boolean {
  return OCCUPIED_ROOM_STATES.includes(status);
}

export function getRoomStateTransitions(from: RoomStatus): RoomStatus[] {
  return [...(ROOM_STATE_TRANSITIONS[from] ?? [])];
}

export function canTransitionRoomState(from: RoomStatus, to: RoomStatus): boolean {
  return getRoomStateTransitions(from).includes(to);
}

export interface RoomTransitionCheck {
  allowed: boolean;
  reason?: string;
  nextStates: RoomStatus[];
}

/**
 * Explains whether a manual state change is permitted. Used by the front desk
 * endpoint so the UI can render disabled actions with a reason.
 */
export function checkRoomStateTransition(params: {
  from: RoomStatus;
  to: RoomStatus;
  isActive?: boolean;
  hasInHouseBooking?: boolean;
}): RoomTransitionCheck {
  const nextStates = getRoomStateTransitions(params.from);

  if (params.from === params.to) {
    return {
      allowed: false,
      reason: `Room is already ${params.to}`,
      nextStates,
    };
  }

  if (!params.isActive && params.to !== "Blocked") {
    return {
      allowed: false,
      reason: "Room is deactivated and can only be set to Blocked until it is re-activated",
      nextStates,
    };
  }

  if (params.from === "Occupied" && params.to !== "Dirty") {
    return {
      allowed: false,
      reason:
        "Room has an in-house guest. Complete the check-out or a room switch to release it.",
      nextStates,
    };
  }

  if (params.hasInHouseBooking && params.to === "Available") {
    return {
      allowed: false,
      reason: "Room is linked to an in-house booking and cannot be made Available directly",
      nextStates,
    };
  }

  if (!canTransitionRoomState(params.from, params.to)) {
    return {
      allowed: false,
      reason: `Room state cannot move from ${params.from} to ${params.to}`,
      nextStates,
    };
  }

  return { allowed: true, nextStates };
}

/** States the front desk should offer as the next action for a room. */
export function getSuggestedNextStates(status: RoomStatus): RoomStatus[] {
  const suggestions: Record<RoomStatus, RoomStatus[]> = {
    Available: ["Clean", "Maintenance", "Blocked"],
    Clean: ["Available", "Dirty", "Maintenance", "Blocked"],
    Dirty: ["Clean", "Available", "Maintenance", "Blocked"],
    Occupied: ["Dirty"],
    Blocked: ["Available", "Maintenance"],
    Maintenance: ["Available", "Clean", "Blocked"],
  };
  return [...(suggestions[status] ?? [])];
}
