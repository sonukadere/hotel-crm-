import { DEFAULT_HOTEL_INFO } from "@hotel/config";
import { Phone, Mail, MapPin, Clock } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Concierge & Reservations
        </h1>
        <p className="text-sm text-slate-400">
          Our royal guest relations desk is at your round-the-clock service.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Contact Info */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 space-y-6">
          <h2 className="text-xl font-bold text-white">Direct Inquiries</h2>

          <div className="space-y-5 text-sm">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-white">{DEFAULT_HOTEL_INFO.name}</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {DEFAULT_HOTEL_INFO.address}, {DEFAULT_HOTEL_INFO.city}, {DEFAULT_HOTEL_INFO.state} - {DEFAULT_HOTEL_INFO.pincode}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-white">Telephone & WhatsApp</p>
                <p className="text-slate-400 text-xs mt-0.5">{DEFAULT_HOTEL_INFO.phone}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-white">Electronic Mail</p>
                <p className="text-slate-400 text-xs mt-0.5">{DEFAULT_HOTEL_INFO.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-white">Check-in / Check-out Timings</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  Standard Check-in: {DEFAULT_HOTEL_INFO.checkInTime} IST • Check-out: {DEFAULT_HOTEL_INFO.checkOutTime} IST
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
            <span className="font-semibold text-white">Corporate Compliance:</span>
            <p>GSTIN: {DEFAULT_HOTEL_INFO.gstin} • State: Maharashtra ({DEFAULT_HOTEL_INFO.stateCode})</p>
          </div>
        </div>

        {/* Message Form */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 space-y-5">
          <h2 className="text-xl font-bold text-white">Send a Message to Concierge</h2>

          <form className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                Your Full Name
              </label>
              <input
                type="text"
                placeholder="Ramesh Sharma"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                Mobile Number
              </label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                Special Request / Inquiry
              </label>
              <textarea
                rows={4}
                placeholder="Airport transfer, dietary preferences, or private event inquiry..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="button"
              className="w-full py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-all cursor-pointer"
            >
              Submit Concierge Request
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
