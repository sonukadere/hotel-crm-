import type { Metadata } from "next";
import Link from "next/link";
import { Hotel, Phone, Mail, ShieldCheck } from "lucide-react";
import "./globals.css";
import { DEFAULT_HOTEL_INFO } from "@hotel/config";

export const metadata: Metadata = {
  title: "Grand Rajwada Palace & Suites | Luxury Heritage Hotel Mumbai",
  description: "Experience royal Indian hospitality with authentic luxury suites, world-class fine dining, and seamless direct booking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col font-sans bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-white">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-600/30">
                <Hotel className="w-6 h-6 text-slate-950 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-white block">
                  {DEFAULT_HOTEL_INFO.name}
                </span>
                <span className="text-[10px] tracking-widest uppercase text-amber-400 font-semibold block">
                  Heritage Luxury & Suites • Mumbai
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
              <Link href="/" className="hover:text-amber-400 transition-colors">
                Home
              </Link>
              <Link href="/rooms" className="hover:text-amber-400 transition-colors">
                Rooms & Suites
              </Link>
              <Link href="/about" className="hover:text-amber-400 transition-colors">
                Heritage & Story
              </Link>
              <Link href="/contact" className="hover:text-amber-400 transition-colors">
                Contact & Location
              </Link>
            </nav>

            <div className="flex items-center gap-4">
              <Link
                href="/rooms"
                className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:from-amber-600 hover:to-amber-700 shadow-md shadow-amber-600/20 transition-all"
              >
                Book Your Stay
              </Link>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="bg-slate-950 border-t border-slate-800/80 py-12 text-slate-400 text-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <h4 className="text-white font-bold text-base">{DEFAULT_HOTEL_INFO.name}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {DEFAULT_HOTEL_INFO.address}, {DEFAULT_HOTEL_INFO.city}, {DEFAULT_HOTEL_INFO.state} - {DEFAULT_HOTEL_INFO.pincode}
              </p>
              <p className="text-xs text-amber-400 font-mono">
                GSTIN: {DEFAULT_HOTEL_INFO.gstin} (State Code: {DEFAULT_HOTEL_INFO.stateCode})
              </p>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Quick Links</h5>
              <ul className="space-y-1.5 text-xs">
                <li><Link href="/rooms" className="hover:text-amber-400">Suites & Tariffs</Link></li>
                <li><Link href="/about" className="hover:text-amber-400">Our Heritage</Link></li>
                <li><Link href="/contact" className="hover:text-amber-400">Concierge & Dining</Link></li>
              </ul>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Guest Assistance</h5>
              <div className="space-y-2 text-xs">
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-amber-400" /> {DEFAULT_HOTEL_INFO.phone}
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-amber-400" /> {DEFAULT_HOTEL_INFO.email}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Indian Compliance</h5>
              <p className="text-xs text-slate-500 leading-relaxed flex items-start gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                GST Invoices generated with SAC 996311. Mandatory UIDAI masked Aadhaar / PAN compliance for verified guest registration.
              </p>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pt-6 border-t border-slate-900 text-center text-xs text-slate-600">
            © {new Date().getFullYear()} {DEFAULT_HOTEL_INFO.name}. All rights reserved. Indian Hospitality Management Engine.
          </div>
        </footer>
      </body>
    </html>
  );
}
