import type { MealPlanCode } from "./types";

export interface StayParams {
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  rooms: number;
  mealPlan: MealPlanCode | null;
  guestStateCode: string | null;
}

export type SearchParams = Record<string, string | string[] | undefined>;

const MEAL_PLANS: MealPlanCode[] = ["EP", "CP", "MAP", "AP"];
const MAX_NIGHTS = 90;

export function toISODay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.trim().length > 0 ? raw.trim() : undefined;
}

function intOf(value: string | undefined, fallback: number, min: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function dayOf(value: string | undefined, fallback: Date): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return toISODay(fallback);
}

function mealPlanOf(value: string | undefined): MealPlanCode | null {
  if (!value) return null;
  const code = value.toUpperCase() as MealPlanCode;
  return MEAL_PLANS.includes(code) ? code : null;
}

/** Sensible defaults so the search widget always posts a valid stay. */
export function defaultStay(): StayParams {
  const today = new Date();
  return {
    checkInDate: toISODay(addDays(today, 7)),
    checkOutDate: toISODay(addDays(today, 9)),
    adults: 2,
    children: 0,
    rooms: 1,
    mealPlan: null,
    guestStateCode: null,
  };
}

export function parseStay(params: SearchParams): StayParams {
  const fallback = defaultStay();
  const checkInDate = dayOf(first(params.checkInDate) ?? first(params.checkIn), new Date(fallback.checkInDate));
  const checkOutDate = dayOf(
    first(params.checkOutDate) ?? first(params.checkOut),
    new Date(fallback.checkOutDate),
  );

  let checkOut = checkOutDate;
  if (checkOut <= checkInDate) checkOut = toISODay(addDays(new Date(checkInDate), 1));
  const maxCheckOut = toISODay(addDays(new Date(checkInDate), MAX_NIGHTS));
  if (checkOut > maxCheckOut) checkOut = maxCheckOut;

  return {
    checkInDate,
    checkOutDate: checkOut,
    adults: intOf(first(params.adults), 2, 1, 12),
    children: intOf(first(params.children), 0, 0, 10),
    rooms: intOf(first(params.rooms), 1, 1, 10),
    mealPlan: mealPlanOf(first(params.mealPlan)),
    guestStateCode: first(params.guestStateCode) ?? first(params.stateCode) ?? null,
  };
}

export function stayQuery(stay: StayParams, extra: Record<string, string | undefined> = {}): string {
  const search = new URLSearchParams({
    checkInDate: stay.checkInDate,
    checkOutDate: stay.checkOutDate,
    adults: String(stay.adults),
    children: String(stay.children),
    rooms: String(stay.rooms),
  });
  if (stay.mealPlan) search.set("mealPlan", stay.mealPlan);
  if (stay.guestStateCode) search.set("guestStateCode", stay.guestStateCode);
  for (const [key, value] of Object.entries(extra)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}

export function staySearchParams(params: SearchParams): Record<string, string | number> {
  const stay = parseStay(params);
  const query: Record<string, string | number> = {
    checkInDate: stay.checkInDate,
    checkOutDate: stay.checkOutDate,
    adults: stay.adults,
    children: stay.children,
    rooms: stay.rooms,
  };
  if (stay.mealPlan) query.mealPlan = stay.mealPlan;
  if (stay.guestStateCode) query.guestStateCode = stay.guestStateCode;
  const roomTypeId = first(params.roomTypeId);
  if (roomTypeId) query.roomTypeId = roomTypeId;
  return query;
}

export function nightsBetween(checkInDate: string, checkOutDate: string): number {
  return Math.round(
    (Date.parse(`${checkOutDate}T00:00:00.000Z`) - Date.parse(`${checkInDate}T00:00:00.000Z`)) /
      86_400_000,
  );
}
