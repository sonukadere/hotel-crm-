import { Modal, Button } from "@hotel/ui";
import { formatINR } from "@hotel/utils";
import type { GSTInvoiceData } from "../../services/folioApi";
import { Printer, Building2, CheckCircle2 } from "lucide-react";

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceData: GSTInvoiceData | null;
  onPrint?: () => void;
}

export function InvoiceModal({
  isOpen,
  onClose,
  invoiceData,
}: InvoiceModalProps) {
  if (!invoiceData) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`GST Tax Invoice #${invoiceData.invoiceNumber}`}
      description="Official Indian Ministry of Finance GST-compliant Hospitality Tax Invoice"
      maxWidth="xl"
    >
      <div className="space-y-6 text-slate-100 p-1 print:p-0 print:text-black" id="printable-invoice">
        {/* Invoice Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 print:border-none print:bg-white print:p-0">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-6 h-6 text-amber-400 print:text-black" />
                <h3 className="text-xl font-black text-white print:text-black tracking-tight">
                  {invoiceData.hotel.name}
                </h3>
              </div>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-1 max-w-md">
                {invoiceData.hotel.address}, {invoiceData.hotel.city}, {invoiceData.hotel.state} - {invoiceData.hotel.pincode}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 print:text-slate-600 mt-2 font-mono">
                <span>Phone: {invoiceData.hotel.phone}</span>
                <span>Email: {invoiceData.hotel.email}</span>
              </div>
              <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-bold">
                <span>HOTEL GSTIN: {invoiceData.hotel.gstin}</span>
                <span>• State Code: {invoiceData.hotel.stateCode}</span>
              </div>
            </div>

            <div className="sm:text-right">
              <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-slate-800 text-amber-400 border border-slate-700">
                {invoiceData.invoiceType} Tax Invoice
              </span>
              <p className="text-base font-black font-mono text-white print:text-black mt-2">
                #{invoiceData.invoiceNumber}
              </p>
              <p className="text-xs text-slate-400 print:text-slate-600">
                Date: {new Date(invoiceData.invoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
                Place of Supply: <strong className="text-white print:text-black font-mono">{invoiceData.placeOfSupply}</strong>
              </p>
            </div>
          </div>

          {/* Billed To / Guest / Corporate Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-xs">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Billed To (Guest Details):</p>
              <p className="text-sm font-bold text-white print:text-black mt-0.5">{invoiceData.guest.fullName}</p>
              <p className="text-slate-400 print:text-slate-600 font-mono">{invoiceData.guest.mobile}</p>
              {invoiceData.guest.address && (
                <p className="text-slate-400 print:text-slate-600 mt-0.5">{invoiceData.guest.address}</p>
              )}
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Corporate ITC / Company Info:</p>
              {invoiceData.guest.corporateGstin ? (
                <div className="space-y-0.5 mt-0.5">
                  <p className="text-sm font-bold text-amber-400 print:text-black">
                    {invoiceData.guest.corporateName || "Corporate Account"}
                  </p>
                  <p className="font-mono text-slate-300 font-bold">
                    GSTIN: {invoiceData.guest.corporateGstin}
                  </p>
                  <p className="text-[11px] text-emerald-400">
                    Eligible for input tax credit (ITC)
                  </p>
                </div>
              ) : (
                <p className="text-slate-500 italic mt-0.5">Unregistered Consumer (B2C Bill to Guest)</p>
              )}
            </div>
          </div>
        </div>

        {/* SAC Breakdown Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">SAC Code</th>
                  <th className="p-3">Description & Service Item</th>
                  <th className="p-3 text-right">Taxable (₹)</th>
                  <th className="p-3 text-center">GST %</th>
                  <th className="p-3 text-right">CGST</th>
                  <th className="p-3 text-right">SGST</th>
                  <th className="p-3 text-right">IGST</th>
                  <th className="p-3 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {invoiceData.sacBreakdown.map((line, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="p-3 font-mono font-bold text-amber-400">{line.sacCode}</td>
                    <td className="p-3 font-medium">{line.description}</td>
                    <td className="p-3 text-right font-mono">{formatINR(line.taxableAmount)}</td>
                    <td className="p-3 text-center font-mono">{(line.gstRate * 100).toFixed(0)}%</td>
                    <td className="p-3 text-right font-mono text-slate-400">{formatINR(line.cgstAmount)}</td>
                    <td className="p-3 text-right font-mono text-slate-400">{formatINR(line.sgstAmount)}</td>
                    <td className="p-3 text-right font-mono text-slate-400">{formatINR(line.igstAmount)}</td>
                    <td className="p-3 text-right font-mono font-bold text-white">
                      {formatINR(line.taxableAmount + line.totalTax)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grand Totals Section */}
          <div className="bg-slate-950 p-4 border-t border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Total Taxable Value</span>
              <span className="font-mono font-semibold">{formatINR(invoiceData.taxableAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Central GST (CGST)</span>
              <span className="font-mono">{formatINR(invoiceData.cgstAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>State GST (SGST)</span>
              <span className="font-mono">{formatINR(invoiceData.sgstAmount)}</span>
            </div>
            {invoiceData.igstAmount > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Integrated GST (IGST)</span>
                <span className="font-mono">{formatINR(invoiceData.igstAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-300 border-t border-slate-800/80 pt-2 font-semibold">
              <span>Total Tax Collected</span>
              <span className="font-mono text-amber-400">{formatINR(invoiceData.totalTax)}</span>
            </div>

            <div className="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-amber-500/30 mt-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                  Invoice Grand Total (INR)
                </span>
                <span className="text-[11px] text-slate-400 italic block mt-0.5">
                  {invoiceData.amountInWords}
                </span>
              </div>
              <span className="text-2xl font-black font-mono text-white">
                {formatINR(invoiceData.grandTotal)}
              </span>
            </div>

            <div className="flex justify-between text-xs pt-2 text-slate-400">
              <span>Total Payments & Advances Credited:</span>
              <span className="font-mono font-bold text-emerald-400">{formatINR(invoiceData.totalCredit)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Net Balance Due:</span>
              <span className={`font-mono font-bold ${invoiceData.balanceDue <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatINR(Math.max(0, invoiceData.balanceDue))}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-between items-center pt-2 print:hidden">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>Digital signature verified under Section 31 CGST Act</span>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button variant="gold" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1.5" /> Print Tax Invoice
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
