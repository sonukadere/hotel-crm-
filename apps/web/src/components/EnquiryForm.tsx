"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Send } from "lucide-react";
import { cleanIndianMobile, isValidIndianMobile } from "@hotel/utils";
import { ApiError, apiPost } from "../lib/api";

export function EnquiryForm() {
  const [form, setForm] = useState({
    guestName: "",
    mobile: "",
    email: "",
    requirement: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [leadId, setLeadId] = useState<string | null>(null);

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const validation: string[] = [];
    if (form.guestName.trim().length < 2) validation.push("Name is required");
    if (!isValidIndianMobile(cleanIndianMobile(form.mobile))) {
      validation.push("Enter a valid 10-digit Indian mobile number");
    }
    if (validation.length > 0) {
      setErrors(validation);
      return;
    }

    setBusy(true);
    setErrors([]);
    try {
      const lead = await apiPost<{ id: string }>("/public/enquiries", {
        guestName: form.guestName.trim(),
        mobile: cleanIndianMobile(form.mobile),
        email: form.email.trim() || undefined,
        requirement: form.requirement.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setLeadId(lead.id);
    } catch (error) {
      setLeadId(null);
      setErrors(error instanceof ApiError ? error.errors : [(error as Error).message]);
    } finally {
      setBusy(false);
    }
  };

  const fieldClass =
    "w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500";

  if (leadId) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 space-y-3 text-center">
        <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
        <p className="text-sm font-semibold text-white">Your enquiry has been received</p>
        <p className="text-xs text-slate-400">
          Our guest relations team will call you back shortly. Reference:{" "}
          <span className="font-mono text-amber-400">{leadId.slice(0, 8).toUpperCase()}</span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-xs">
      <div>
        <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
          Your Full Name
        </label>
        <input
          type="text"
          placeholder="Ramesh Sharma"
          className={fieldClass}
          value={form.guestName}
          onChange={(e) => set("guestName", e.target.value)}
        />
      </div>

      <div>
        <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
          Mobile Number
        </label>
        <input
          type="tel"
          placeholder="98765 43210"
          className={fieldClass}
          value={form.mobile}
          onChange={(e) => set("mobile", e.target.value)}
          inputMode="numeric"
        />
      </div>

      <div>
        <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
          Email (optional)
        </label>
        <input
          type="email"
          placeholder="you@example.com"
          className={fieldClass}
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </div>

      <div>
        <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
          Nature of enquiry
        </label>
        <select
          className={fieldClass}
          value={form.requirement}
          onChange={(e) => set("requirement", e.target.value)}
        >
          <option value="">Select an option</option>
          <option value="Room booking">Room booking</option>
          <option value="Group / wedding stay">Group / wedding stay</option>
          <option value="Banquet & events">Banquet & events</option>
          <option value="Dining reservation">Dining reservation</option>
          <option value="Spa & wellness">Spa & wellness</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div>
        <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
          Special Request / Inquiry
        </label>
        <textarea
          rows={4}
          placeholder="Airport transfer, dietary preferences, or private event inquiry..."
          className={fieldClass}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3 space-y-1">
          {errors.map((error) => (
            <p key={error} className="text-xs text-red-200/80 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
            </p>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-all cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Submit Concierge Request
      </button>
    </form>
  );
}
