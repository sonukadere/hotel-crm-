import { DEFAULT_HOTEL_INFO } from "@hotel/config";
import { Phone, Mail, MapPin, Clock, ShieldCheck } from "lucide-react";
import { apiGet } from "../../lib/api";
import type { PublicHotel } from "../../lib/types";
import { EnquiryForm } from "../../components/EnquiryForm";

export const dynamic = "force-dynamic";

async function getHotel() {
  try {
    return await apiGet<PublicHotel>("/public/hotel", {}, { timeoutMs: 4000 });
  } catch {
    return null;
  }
}

export default async function ContactPage() {
  const hotel = await getHotel();
  const info = hotel
    ? {
        name: hotel.name,
        address: `${hotel.address}, ${hotel.city}, ${hotel.state} - ${hotel.pincode}`,
        phone: hotel.phone,
        email: hotel.email,
        checkInTime: hotel.checkInTime,
        checkOutTime: hotel.checkOutTime,
        gstin: hotel.gstin,
        stateCode: hotel.stateCode,
      }
    : {
        name: DEFAULT_HOTEL_INFO.name,
        address: `${DEFAULT_HOTEL_INFO.address}, ${DEFAULT_HOTEL_INFO.city}, ${DEFAULT_HOTEL_INFO.state} - ${DEFAULT_HOTEL_INFO.pincode}`,
        phone: DEFAULT_HOTEL_INFO.phone,
        email: DEFAULT_HOTEL_INFO.email,
        checkInTime: DEFAULT_HOTEL_INFO.checkInTime,
        checkOutTime: DEFAULT_HOTEL_INFO.checkOutTime,
        gstin: DEFAULT_HOTEL_INFO.gstin,
        stateCode: DEFAULT_HOTEL_INFO.stateCode,
      };

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
                <p className="font-bold text-white">{info.name}</p>
                <p className="text-slate-400 text-xs mt-0.5">{info.address}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-white">Telephone & WhatsApp</p>
                <p className="text-slate-400 text-xs mt-0.5">{info.phone}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-white">Electronic Mail</p>
                <p className="text-slate-400 text-xs mt-0.5">{info.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-white">Check-in / Check-out Timings</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  Standard Check-in: {info.checkInTime} IST • Check-out: {info.checkOutTime} IST
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
            <span className="font-semibold text-white">Corporate Compliance:</span>
            <p>
              GSTIN: {info.gstin} • State Code: {info.stateCode}
            </p>
            <p className="flex items-center gap-1.5 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              GST-compliant invoicing on every stay and service
            </p>
          </div>
        </div>

        {/* Message Form */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 space-y-5">
          <h2 className="text-xl font-bold text-white">Send a Message to Concierge</h2>
          <p className="text-xs text-slate-400">
            Your enquiry is logged with our reservations team and we call back within 30 minutes.
          </p>
          <EnquiryForm />
        </div>
      </div>
    </div>
  );
}
