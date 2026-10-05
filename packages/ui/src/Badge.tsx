import React from "react";
import { cn } from "./utils";
import type { RoomStatus, BookingStatus } from "@hotel/types";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "danger" | "info" | "gold";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "bg-slate-900 text-white",
    secondary: "bg-slate-100 text-slate-800",
    outline: "text-slate-800 border border-slate-300",
    success: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    warning: "bg-amber-100 text-amber-800 border border-amber-200",
    danger: "bg-rose-100 text-rose-800 border border-rose-200",
    info: "bg-sky-100 text-sky-800 border border-sky-200",
    gold: "bg-amber-50 text-amber-900 border border-amber-300 font-semibold",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors select-none",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Dedicated Room Status Badge with standard PMS color coding
 */
export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const config: Record<RoomStatus, { label: string; className: string }> = {
    Available: { label: "Available", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    Clean: { label: "Clean", className: "bg-blue-100 text-blue-800 border-blue-300" },
    Dirty: { label: "Dirty", className: "bg-amber-100 text-amber-800 border-amber-300" },
    Occupied: { label: "Occupied", className: "bg-rose-100 text-rose-800 border-rose-300" },
    Blocked: { label: "Blocked", className: "bg-slate-200 text-slate-800 border-slate-300" },
    Maintenance: { label: "Maintenance", className: "bg-orange-100 text-orange-800 border-orange-300" },
  };

  const item = config[status] ?? { label: status, className: "bg-gray-100 text-gray-800" };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
        item.className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {item.label}
    </span>
  );
}

/**
 * Dedicated Booking Status Badge
 */
export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const config: Record<BookingStatus, { label: string; className: string }> = {
    Inquiry: { label: "Inquiry", className: "bg-slate-100 text-slate-700 border-slate-300" },
    Tentative: { label: "Tentative", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    Confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-800 border-blue-300" },
    CheckedIn: { label: "Checked In", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    CheckedOut: { label: "Checked Out", className: "bg-purple-100 text-purple-800 border-purple-300" },
    Cancelled: { label: "Cancelled", className: "bg-rose-100 text-rose-800 border-rose-300" },
    NoShow: { label: "No Show", className: "bg-red-100 text-red-900 border-red-300" },
  };

  const item = config[status] ?? { label: status, className: "bg-gray-100 text-gray-800" };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
        item.className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {item.label}
    </span>
  );
}
