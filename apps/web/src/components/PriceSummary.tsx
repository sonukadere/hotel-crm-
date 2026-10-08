import { formatINR } from "@hotel/utils";
import { AlertTriangle } from "lucide-react";
import type { PublicQuote } from "../lib/types";

interface PriceSummaryProps {
  quote: PublicQuote;
  title?: string;
  className?: string;
}

/**
 * Renders the server-calculated price. The client only ever displays these
 * numbers - it never derives an amount of its own.
 */
export function PriceSummary({ quote, title = "Price summary", className = "" }: PriceSummaryProps) {
  return (
    <div className={`bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3 ${className}`}>
      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{title}</h3>

      <ul className="space-y-2 text-xs">
        {quote.lines
          .filter((line) => line.kind !== "total")
          .map((line) => (
            <li
              key={line.key}
              className={`flex items-start justify-between gap-4 ${
                line.kind === "discount"
                  ? "text-emerald-400"
                  : line.kind === "tax"
                    ? "text-slate-400"
                    : "text-slate-300"
              }`}
            >
              <span className="leading-relaxed">{line.label}</span>
              <span className="font-mono whitespace-nowrap">
                {line.amount < 0 ? "-" : ""}
                {formatINR(Math.abs(line.amount))}
              </span>
            </li>
          ))}
      </ul>

      <div className="pt-3 border-t border-slate-800 flex items-baseline justify-between gap-3">
        <span className="text-xs font-bold text-white uppercase tracking-wider">
          {quote.lines.find((line) => line.kind === "total")?.label ?? "Final amount payable"}
        </span>
        <span className="text-2xl font-extrabold text-amber-400 font-mono">
          {formatINR(quote.summary.finalAmount)}
        </span>
      </div>

      {quote.summary.amountInWords && (
        <p className="text-[11px] text-slate-500 leading-relaxed">
          {quote.summary.amountInWords}
        </p>
      )}

      <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
        GST included: {formatINR(quote.summary.gst)} • Place of supply {quote.gst.placeOfSupply} •
        {quote.gst.isInterState ? " IGST" : " CGST + SGST"}
      </p>

      {quote.warnings.length > 0 && (
        <ul className="space-y-1 pt-2 border-t border-slate-800">
          {quote.warnings.map((warning, index) => (
            <li key={index} className="flex items-start gap-1.5 text-[11px] text-amber-400/90">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
