/**
 * Hospitality Date Utilities
 */

export function parseISODate(dateStr: string): Date {
  const parts = dateStr.split("T")[0]?.split("-");
  if (!parts || parts.length < 3) {
    return new Date(dateStr);
  }
  const year = parseInt(parts[0]!, 10);
  const month = parseInt(parts[1]!, 10) - 1;
  const day = parseInt(parts[2]!, 10);
  return new Date(Date.UTC(year, month, day));
}

export function formatDateToISO(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

export function formatIndianDate(dateStrOrDate: string | Date): string {
  const date = typeof dateStrOrDate === "string" ? parseISODate(dateStrOrDate) : dateStrOrDate;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function calculateNights(checkIn: string, checkOut: string): number {
  const inDate = parseISODate(checkIn);
  const outDate = parseISODate(checkOut);
  const diffTime = outDate.getTime() - inDate.getTime();
  const nights = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 1;
}

export function isWeekendNight(date: Date): boolean {
  // Friday night (5) and Saturday night (6) are peak hotel weekend nights
  const dayOfWeek = date.getUTCDay();
  return dayOfWeek === 5 || dayOfWeek === 6;
}

export function getNightlyDates(checkIn: string, checkOut: string): string[] {
  const dates: string[] = [];
  const inDate = parseISODate(checkIn);
  const outDate = parseISODate(checkOut);
  
  const current = new Date(inDate.getTime());
  while (current.getTime() < outDate.getTime()) {
    dates.push(formatDateToISO(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}
