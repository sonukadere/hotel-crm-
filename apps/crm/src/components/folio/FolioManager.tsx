import { useState, useEffect } from "react";
import { Button, Input } from "@hotel/ui";
import { formatINR, validateCashCompliance } from "@hotel/utils";
import type { FolioItemType, PaymentMethod } from "@hotel/types";
import {
  fetchFoliosApi,
  fetchFolioByIdApi,
  addFolioItemApi,
  editFolioItemApi,
  voidFolioItemApi,
  applyFolioDiscountApi,
  recordFolioPaymentApi,
  refundFolioPaymentApi,
  generateFolioInvoiceApi,
  createRazorpayOrderApi,
  verifyRazorpayPaymentApi,
  type FolioDetail,
  type FolioSummaryItem,
  type GSTInvoiceData,
} from "../../services/folioApi";
import { InvoiceModal } from "./InvoiceModal";
import {
  FileText,
  Plus,
  Tag,
  CreditCard,
  RotateCcw,
  Printer,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle2,
  Building2,
  User,
  Search,
  Split,
  Receipt,
  BedDouble,
  Loader2,
} from "lucide-react";

export function FolioManager() {
  const [foliosList, setFoliosList] = useState<any[]>([]);
  const [selectedFolioId, setSelectedFolioId] = useState<string>("");
  const [folio, setFolio] = useState<FolioDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSplit, setFilterSplit] = useState<"ALL" | "Corporate" | "Personal">("ALL");

  // Notifications
  const [notice, setNotice] = useState<{ msg: string; isError?: boolean } | null>(null);

  // Modals state
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FolioSummaryItem | null>(null);

  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [refundingPaymentId, setRefundingPaymentId] = useState("");

  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<GSTInvoiceData | null>(null);

  // Add Item form state
  const [itemType, setItemType] = useState<FolioItemType>("Food");
  const [itemDescription, setItemDescription] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [itemUnitPrice, setItemUnitPrice] = useState("500");
  const [itemSplitTarget, setItemSplitTarget] = useState<"Corporate" | "Personal">("Personal");

  // Discount form state
  const [discountAmount, setDiscountAmount] = useState("500");
  const [discountReason, setDiscountReason] = useState("Management Courtesy / VIP Privilege");
  const [discountSplitTarget, setDiscountSplitTarget] = useState<"Corporate" | "Personal">("Personal");

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentPan, setPaymentPan] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isAdvanceDeposit, setIsAdvanceDeposit] = useState(false);
  const [cashWarning, setCashWarning] = useState("");

  // Refund form state
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("Guest dispute / billing correction");

  // Action loaders
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadFolios();
  }, []);

  useEffect(() => {
    if (selectedFolioId) {
      loadFolioDetail(selectedFolioId);
    }
  }, [selectedFolioId]);

  const loadFolios = async () => {
    setLoading(true);
    try {
      const list = await fetchFoliosApi();
      setFoliosList(list);
      if (list.length > 0 && !selectedFolioId) {
        setSelectedFolioId(list[0].id);
      }
    } catch (_e) {
    } finally {
      setLoading(false);
    }
  };

  const loadFolioDetail = async (id: string) => {
    setLoading(true);
    try {
      const data = await fetchFolioByIdApi(id);
      setFolio(data);
      if (data) {
        setPaymentAmount(data.summary.balanceDue > 0 ? String(data.summary.balanceDue) : "0");
      }
    } catch (_e) {
    } finally {
      setLoading(false);
    }
  };

  const showNotice = (msg: string, isError = false) => {
    setNotice({ msg, isError });
    setTimeout(() => setNotice(null), 5000);
  };

  // Add Item Handler
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolioId) return;

    setActionLoading(true);
    try {
      await addFolioItemApi(selectedFolioId, {
        itemType,
        description: itemDescription.trim() || `${itemType} Service`,
        quantity: parseInt(itemQuantity, 10) || 1,
        unitPrice: parseFloat(itemUnitPrice) || 0,
        splitTarget: itemSplitTarget,
      });

      showNotice(`Added ${itemType} charge to folio successfully.`);
      setIsAddItemOpen(false);
      setItemDescription("");
      loadFolioDetail(selectedFolioId);
    } catch (err: any) {
      showNotice(err.message || "Failed to add charge", true);
    } finally {
      setActionLoading(false);
    }
  };

  // Edit Item Handler
  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setActionLoading(true);
    try {
      await editFolioItemApi(editingItem.id, {
        description: editingItem.description,
        quantity: editingItem.quantity,
        unitPrice: editingItem.unitPrice,
        splitTarget: editingItem.splitTarget,
      });

      showNotice("Folio item updated with audit trail.");
      setIsEditItemOpen(false);
      setEditingItem(null);
      loadFolioDetail(selectedFolioId);
    } catch (err: any) {
      showNotice(err.message || "Failed to update item", true);
    } finally {
      setActionLoading(false);
    }
  };

  // Void Item Handler
  const handleVoidItem = async (itemId: string) => {
    const reason = window.prompt("Enter mandatory reason for voiding this folio item (Audit Compliance):");
    if (!reason || !reason.trim()) return;

    setActionLoading(true);
    try {
      await voidFolioItemApi(itemId, reason.trim());
      showNotice("Folio item voided and removed from active debit.");
      loadFolioDetail(selectedFolioId);
    } catch (err: any) {
      showNotice(err.message || "Failed to void item", true);
    } finally {
      setActionLoading(false);
    }
  };

  // Apply Discount Handler
  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolioId) return;

    const amt = parseFloat(discountAmount) || 0;
    if (amt <= 0) return;

    setActionLoading(true);
    try {
      await applyFolioDiscountApi(selectedFolioId, amt, discountReason, discountSplitTarget);
      showNotice(`Applied promotional credit of ${formatINR(amt)}.`);
      setIsDiscountOpen(false);
      loadFolioDetail(selectedFolioId);
    } catch (err: any) {
      showNotice(err.message || "Failed to apply discount", true);
    } finally {
      setActionLoading(false);
    }
  };

  // Payment Handler
  const handlePaymentMethodChange = (m: PaymentMethod) => {
    setPaymentMethod(m);
    const amt = parseFloat(paymentAmount) || 0;
    if (m === "Cash") {
      const compliance = validateCashCompliance(amt, paymentPan);
      setCashWarning(compliance.isValid ? "" : compliance.errors.join(". "));
    } else {
      setCashWarning("");
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolioId) return;

    const amt = parseFloat(paymentAmount) || 0;
    if (amt <= 0) return;

    if (paymentMethod === "Cash") {
      const compliance = validateCashCompliance(amt, paymentPan);
      if (!compliance.isValid) {
        showNotice(compliance.errors.join(". "), true);
        return;
      }
    }

    setActionLoading(true);
    try {
      if (paymentMethod === "Razorpay") {
        // Step 1: Create order on backend
        const order = await createRazorpayOrderApi(selectedFolioId, amt);

        // Step 2 & 3: Open Razorpay checkout if script loaded, or prompt simulated payment
        if (typeof (window as any).Razorpay !== "undefined") {
          const rzp = new (window as any).Razorpay({
            key: order.keyId,
            amount: order.amount,
            currency: order.currency,
            name: (folio as any)?.hotel?.name || "Grand Palace Hotel",
            description: `Folio #${folio?.folioNumber || selectedFolioId} Settlement`,
            order_id: order.orderId,
            prefill: {
              name: folio?.guest?.fullName,
              contact: folio?.guest?.mobile,
              email: folio?.guest?.email,
            },
            theme: { color: "#f59e0b" },
            handler: async (response: any) => {
              try {
                // Step 5: Verify signature on backend
                await verifyRazorpayPaymentApi({
                  folioId: selectedFolioId,
                  razorpayOrderId: response.razorpay_order_id || order.orderId,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                  amount: amt,
                  notes: paymentNotes || undefined,
                });
                showNotice(`Razorpay payment of ${formatINR(amt)} captured & verified successfully.`);
                setIsPaymentOpen(false);
                loadFolioDetail(selectedFolioId);
              } catch (verifyErr: any) {
                showNotice(verifyErr.message || "Payment verification failed", true);
              }
            },
          });
          rzp.open();
          return;
        } else {
          // Frontend simulated / test checkout fallback
          const simPaymentId = `pay_sim_${Date.now()}`;
          const simSignature = `simulated_${Date.now()}`;
          await verifyRazorpayPaymentApi({
            folioId: selectedFolioId,
            razorpayOrderId: order.orderId,
            razorpayPaymentId: simPaymentId,
            razorpaySignature: simSignature,
            amount: amt,
            notes: paymentNotes || "Front Desk Simulated Razorpay",
          });
          showNotice(`Razorpay payment of ${formatINR(amt)} captured and verified.`);
          setIsPaymentOpen(false);
          loadFolioDetail(selectedFolioId);
          return;
        }
      }

      await recordFolioPaymentApi(selectedFolioId, {
        amount: amt,
        method: paymentMethod,
        transactionRef: paymentRef || undefined,
        panNumber: paymentPan || undefined,
        notes: paymentNotes || undefined,
        isAdvance: isAdvanceDeposit,
      });

      showNotice(`Payment of ${formatINR(amt)} recorded successfully via ${paymentMethod}.`);
      setIsPaymentOpen(false);
      loadFolioDetail(selectedFolioId);
    } catch (err: any) {
      showNotice(err.message || "Failed to record payment", true);
    } finally {
      setActionLoading(false);
    }
  };

  // Refund Handler
  const handleRefundPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundingPaymentId) return;

    const amt = refundAmount ? parseFloat(refundAmount) : undefined;

    setActionLoading(true);
    try {
      await refundFolioPaymentApi(refundingPaymentId, refundReason, amt);
      showNotice("Refund captured and audit record logged.");
      setIsRefundOpen(false);
      setRefundingPaymentId("");
      loadFolioDetail(selectedFolioId);
    } catch (err: any) {
      showNotice(err.message || "Refund failed", true);
    } finally {
      setActionLoading(false);
    }
  };

  // Generate Invoice Handler
  const handleGenerateInvoice = async (type: "Consolidated" | "Corporate" | "Personal") => {
    if (!selectedFolioId) return;
    setActionLoading(true);
    try {
      const data = await generateFolioInvoiceApi(selectedFolioId, type);
      setInvoiceData(data);
      setIsInvoiceOpen(true);
    } catch (err: any) {
      showNotice(err.message || "Failed to generate invoice", true);
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered displayed items
  const displayedItems = (folio?.items || []).filter((item) => {
    if (filterSplit !== "ALL" && item.splitTarget !== filterSplit) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.description.toLowerCase().includes(q) ||
        item.sacCode.toLowerCase().includes(q) ||
        item.itemType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Notice Toast */}
      {notice && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border backdrop-blur-md animate-fade-in ${
            notice.isError
              ? "bg-rose-500/95 text-white border-rose-400"
              : "bg-emerald-500/95 text-slate-950 border-emerald-400"
          }`}
        >
          {notice.isError ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{notice.msg}</span>
        </div>
      )}

      {/* Top Workspace Header */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            Hotel Folio, Split Billing & GST Invoicing Workspace
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Centralized folio ledger with live SAC tax distribution, multi-target corporate splitting, and statutory Indian invoicing.
          </p>
        </div>

        {/* Folio Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Select Folio:</span>
            <select
              value={selectedFolioId}
              onChange={(e) => setSelectedFolioId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500 max-w-[220px]"
            >
              {foliosList.map((f) => (
                <option key={f.id} value={f.id}>
                  #{f.folioNumber} • {f.guest.fullName} ({f.booking?.room?.roomNumber ? `Rm ${f.booking.room.roomNumber}` : f.status})
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDiscountOpen(true)}
            className="text-xs border-slate-700 text-slate-300 hover:text-white"
          >
            <Tag className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Apply Discount
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaymentOpen(true)}
            className="text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10 font-semibold"
          >
            <CreditCard className="w-3.5 h-3.5 mr-1" /> Record Payment
          </Button>

          <Button
            variant="gold"
            size="sm"
            onClick={() => setIsAddItemOpen(true)}
            className="text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Folio Charge
          </Button>
        </div>
      </div>

      {loading && !folio ? (
        <div className="p-16 flex flex-col items-center justify-center space-y-3 bg-slate-950/70 border border-slate-800 rounded-xl">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-xs text-slate-400">Loading active folio ledger & recalculating SAC distributions...</p>
        </div>
      ) : folio ? (
        <div className="space-y-6">
          {/* Folio Info Banner */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold uppercase tracking-wider text-[10px]">Primary Guest</span>
              </div>
              <p className="text-white font-bold text-sm mt-1">{folio.guest.fullName}</p>
              <p className="text-slate-500 font-mono text-[11px]">{folio.guest.mobile}</p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold uppercase tracking-wider text-[10px]">Corporate B2B Account</span>
              </div>
              {folio.guest.corporateGstin ? (
                <div className="mt-1">
                  <p className="text-amber-400 font-semibold">{folio.guest.corporateName || "Company Account"}</p>
                  <p className="font-mono text-slate-400 text-[11px]">GSTIN: {folio.guest.corporateGstin}</p>
                </div>
              ) : (
                <p className="text-slate-500 italic mt-1">Individual Guest (B2C)</p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <BedDouble className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold uppercase tracking-wider text-[10px]">Stay Allocation</span>
              </div>
              <p className="text-white font-bold mt-1">
                {folio.booking?.room?.roomNumber ? `Room ${folio.booking.room.roomNumber}` : "Room Pending"} ({folio.booking?.roomType?.name || "Standard"})
              </p>
              <p className="text-slate-400 text-[11px]">
                Booking #{folio.booking?.bookingNumber} • {folio.booking?.totalNights || 1} Night(s)
              </p>
            </div>

            <div className="flex flex-col justify-between items-start md:items-end">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  folio.status === "Settled"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                }`}
              >
                {folio.status} Folio #{folio.folioNumber}
              </span>

              {/* Invoice Generation Buttons */}
              <div className="flex items-center gap-1.5 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateInvoice("Consolidated")}
                  className="text-[11px] h-7 px-2.5 border-slate-700 text-slate-300 hover:text-white"
                >
                  <Printer className="w-3 h-3 mr-1" /> Tax Invoice
                </Button>
                {folio.guest.corporateGstin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateInvoice("Corporate")}
                    className="text-[11px] h-7 px-2 border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                    title="Generate Company Room & GST Invoice"
                  >
                    Corp Invoice
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Centralized KPI Financial Breakdown Cards (Module 7 Formula) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Room Charges (SAC 996311)</p>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className="text-xl font-black text-white">{formatINR(folio.summary.discountedRoomSubtotal)}</span>
                <span className="text-xs font-mono text-amber-400">+{formatINR(folio.summary.totalRoomGST)} GST</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Subtotal: {formatINR(folio.summary.discountedRoomSubtotal + folio.summary.totalRoomGST)}
                {folio.summary.roomDiscount > 0 && ` (Disc: -${formatINR(folio.summary.roomDiscount)})`}
              </p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Services & Add-Ons</p>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className="text-xl font-black text-white">{formatINR(folio.summary.totalServicesCharges)}</span>
                <span className="text-xs font-mono text-amber-400">+{formatINR(folio.summary.totalServicesGST)} GST</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">F&B, Laundry, Spa, Banquet, Housekeeping</p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Total Credits & Payments</p>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className="text-xl font-black text-emerald-400">{formatINR(folio.summary.totalCredit)}</span>
                <span className="text-xs font-mono text-slate-400">
                  {folio.summary.advanceDeposit > 0 ? `Adv: ${formatINR(folio.summary.advanceDeposit)}` : "Captured"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Cash: {formatINR(folio.summary.cashCollected)} • Razorpay/Digital: {formatINR(folio.summary.totalCredit - folio.summary.cashCollected)}
              </p>
            </div>

            <div className={`p-4 rounded-xl border ${folio.summary.balanceDue <= 0 ? "bg-emerald-950/30 border-emerald-500/40" : "bg-slate-950/70 border-amber-500/40"}`}>
              <p className={`text-[11px] font-bold uppercase tracking-wider ${folio.summary.balanceDue <= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                {folio.summary.balanceDue <= 0 ? "Folio Fully Settled" : "Net Balance Due"}
              </p>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className={`text-2xl font-black font-mono ${folio.summary.balanceDue <= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                  {formatINR(Math.max(0, folio.summary.balanceDue))}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Debit: {formatINR(folio.summary.totalDebit)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 italic truncate mt-2">
                {folio.summary.amountInWords}
              </p>
            </div>
          </div>

          {/* Split Billing Summary Banner (Corporate vs Personal) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Split className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white uppercase tracking-wider">Split Billing Distribution:</span>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-slate-400">Company (Tata Steel):</span>
                <strong className="text-white font-mono">{formatINR(folio.summary.corporate.debit)}</strong>
                <span className="text-[11px] text-slate-500 font-mono">(Due: {formatINR(folio.summary.corporate.balanceDue)})</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                <span className="text-slate-400">Personal (Guest):</span>
                <strong className="text-white font-mono">{formatINR(folio.summary.personal.debit)}</strong>
                <span className="text-[11px] text-slate-500 font-mono">(Due: {formatINR(folio.summary.personal.balanceDue)})</span>
              </div>
            </div>

            {/* Split Filter Toggle */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              {(["ALL", "Corporate", "Personal"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setFilterSplit(filter)}
                  className={`px-3 py-1 rounded text-[11px] font-semibold transition-all ${
                    filterSplit === filter
                      ? "bg-amber-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Folio Items Table */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Itemized Charges & Statutory SAC Ledger ({displayedItems.length} lines)
                </h3>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter charges by description or SAC..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs rounded-lg pl-8 pr-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-64"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="p-3">Category / SAC</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Split Target</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Taxable</th>
                    <th className="p-3 text-center">GST %</th>
                    <th className="p-3 text-right">GST (₹)</th>
                    <th className="p-3 text-right">Total (₹)</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {displayedItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">
                        No folio items found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    displayedItems.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-900/40 transition-colors ${
                          item.isVoided ? "opacity-40 line-through bg-slate-900/20" : ""
                        }`}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white">{item.itemType}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-800">
                              {item.sacCode}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 font-medium">
                          {item.description}
                          {item.isVoided && (
                            <span className="block text-[10px] text-rose-400 not-italic no-underline">
                              Voided: {item.voidReason || "By staff"}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                              item.splitTarget === "Corporate"
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                            }`}
                          >
                            {item.splitTarget}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono">{item.quantity}</td>
                        <td className="p-3 text-right font-mono">{formatINR(item.unitPrice)}</td>
                        <td className="p-3 text-right font-mono font-semibold">
                          {formatINR(item.totalPrice)}
                        </td>
                        <td className="p-3 text-center font-mono">
                          {(item.gstRate * 100).toFixed(0)}%
                        </td>
                        <td className="p-3 text-right font-mono text-amber-400">
                          {formatINR(item.gstAmount)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-white">
                          {formatINR(item.totalPrice + item.gstAmount)}
                        </td>
                        <td className="p-3 text-center">
                          {!item.isVoided && (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setIsEditItemOpen(true);
                                }}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                title="Edit Item"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleVoidItem(item.id)}
                                className="p-1 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-400"
                                title="Void / Remove Item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payments & Credits Ledger */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Payments, Advances & Settlement Credits
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPaymentOpen(true)}
                className="text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                <Plus className="w-3 h-3 mr-1" /> Add Payment
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="p-3">Payment #</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Notes & References</th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3 text-right">Amount (₹)</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {folio.payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        No payments or advances captured on this folio yet.
                      </td>
                    </tr>
                  ) : (
                    folio.payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-slate-900/40">
                        <td className="p-3 font-mono font-bold text-amber-400">
                          {payment.paymentNumber}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-900 border border-slate-700 text-slate-200">
                            {payment.method}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              payment.status === "Captured"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            }`}
                          >
                            {payment.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">
                          {payment.notes || "—"}
                          {payment.transactionRef && (
                            <span className="block font-mono text-[10px] text-slate-500">
                              Ref: {payment.transactionRef}
                            </span>
                          )}
                          {payment.panNumber && (
                            <span className="block font-mono text-[10px] text-amber-400">
                              PAN: {payment.panNumber}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-400 text-[11px]">
                          {new Date(payment.receivedAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-400 text-sm">
                          {formatINR(payment.amount)}
                        </td>
                        <td className="p-3 text-center">
                          {payment.status === "Captured" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRefundingPaymentId(payment.id);
                                setRefundAmount(String(payment.amount));
                                setIsRefundOpen(true);
                              }}
                              className="text-[10px] h-6 px-2 border-slate-700 text-slate-400 hover:text-rose-400"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" /> Refund
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* MODAL 1: ADD FOLIO ITEM */}
      {isAddItemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" /> Add Charge to Folio
              </h3>
              <button onClick={() => setIsAddItemOpen(false)} className="text-slate-400 hover:text-white text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold uppercase tracking-wider mb-1">
                    Service Category *
                  </label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as FolioItemType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 h-9"
                  >
                    <option value="Room">Room Charges (SAC 996311)</option>
                    <option value="Food">Food & Beverage (SAC 996331)</option>
                    <option value="Restaurant">Restaurant (SAC 996331)</option>
                    <option value="InRoomDining">In-Room Dining (SAC 996331)</option>
                    <option value="Laundry">Laundry Service (SAC 999799)</option>
                    <option value="Spa">Spa & Wellness (SAC 999722)</option>
                    <option value="Housekeeping">Housekeeping Add-ons (SAC 999799)</option>
                    <option value="Banquet">Banquet & Meeting Hall (SAC 997212)</option>
                    <option value="OtherService">Other Hotel Service (SAC 999799)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold uppercase tracking-wider mb-1">
                    Split Target *
                  </label>
                  <select
                    value={itemSplitTarget}
                    onChange={(e) => setItemSplitTarget(e.target.value as "Corporate" | "Personal")}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 h-9"
                  >
                    <option value="Personal">Personal (Guest Self Pay)</option>
                    <option value="Corporate">Corporate (Company B2B Bill)</option>
                  </select>
                </div>
              </div>

              <Input
                label="Description & Item Notes *"
                placeholder="e.g. Traditional Awadhi Thali / Express Silk Dry Cleaning"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Quantity *"
                  type="number"
                  min="1"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value)}
                  required
                />
                <Input
                  label="Unit Price (INR) *"
                  type="number"
                  step="0.01"
                  value={itemUnitPrice}
                  onChange={(e) => setItemUnitPrice(e.target.value)}
                  required
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Estimated Total (Before GST):</span>
                <span className="font-mono font-bold text-white text-sm">
                  {formatINR((parseInt(itemQuantity, 10) || 1) * (parseFloat(itemUnitPrice) || 0))}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddItemOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="gold" size="sm" disabled={actionLoading}>
                  {actionLoading ? "Posting Charge..." : "Post to Folio"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT FOLIO ITEM */}
      {isEditItemOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" /> Edit Folio Item
              </h3>
              <button onClick={() => setIsEditItemOpen(false)} className="text-slate-400 hover:text-white text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleEditItem} className="space-y-4 text-xs">
              <p className="text-slate-400">
                Category: <strong className="text-white">{editingItem.itemType}</strong> • SAC: <strong className="text-amber-400 font-mono">{editingItem.sacCode}</strong>
              </p>

              <Input
                label="Description"
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Quantity"
                  type="number"
                  min="1"
                  value={editingItem.quantity}
                  onChange={(e) => setEditingItem({ ...editingItem, quantity: parseInt(e.target.value, 10) || 1 })}
                  required
                />
                <Input
                  label="Unit Price (INR)"
                  type="number"
                  step="0.01"
                  value={editingItem.unitPrice}
                  onChange={(e) => setEditingItem({ ...editingItem, unitPrice: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold uppercase tracking-wider mb-1">
                  Split Target
                </label>
                <select
                  value={editingItem.splitTarget}
                  onChange={(e) => setEditingItem({ ...editingItem, splitTarget: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 h-9"
                >
                  <option value="Personal">Personal (Guest Bill)</option>
                  <option value="Corporate">Corporate (Company B2B)</option>
                </select>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-[11px]">
                Statutory Notice: Modifying an existing folio line creates an immutable audit trail record.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsEditItemOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="gold" size="sm" disabled={actionLoading}>
                  {actionLoading ? "Updating..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: APPLY DISCOUNT */}
      {isDiscountOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" /> Apply Folio Discount
              </h3>
              <button onClick={() => setIsDiscountOpen(false)} className="text-slate-400 hover:text-white text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyDiscount} className="space-y-4 text-xs">
              <Input
                label="Discount Amount (INR) *"
                type="number"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                required
              />

              <Input
                label="Reason for Discount *"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="e.g. VIP guest courtesy, service recovery"
                required
              />

              <div>
                <label className="block text-slate-400 font-semibold uppercase tracking-wider mb-1">
                  Apply Against
                </label>
                <select
                  value={discountSplitTarget}
                  onChange={(e) => setDiscountSplitTarget(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 h-9"
                >
                  <option value="Personal">Personal Guest Charges</option>
                  <option value="Corporate">Corporate Company Charges</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsDiscountOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="gold" size="sm" disabled={actionLoading}>
                  {actionLoading ? "Applying..." : "Confirm Discount"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RECORD PAYMENT */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" /> Record Folio Payment / Advance
              </h3>
              <button onClick={() => setIsPaymentOpen(false)} className="text-slate-400 hover:text-white text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Amount (INR) *"
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => {
                    setPaymentAmount(e.target.value);
                    const amt = parseFloat(e.target.value) || 0;
                    if (paymentMethod === "Cash") {
                      const c = validateCashCompliance(amt, paymentPan);
                      setCashWarning(c.isValid ? "" : c.errors.join(". "));
                    }
                  }}
                  required
                />

                <div>
                  <label className="block text-slate-400 font-semibold uppercase tracking-wider mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => handlePaymentMethodChange(e.target.value as PaymentMethod)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 h-9"
                  >
                    <option value="UPI">UPI (QR Code / VPA)</option>
                    <option value="Card">Card (Credit / Debit POS)</option>
                    <option value="Cash">Cash (Physical Currency)</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT / RTGS)</option>
                    <option value="Razorpay">Razorpay / Payment Gateway</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Transaction Ref / Auth Code"
                  placeholder="e.g. UPI/12345678 or POS-981"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />

                {paymentMethod === "Cash" && (
                  <Input
                    label="PAN (Mandatory if Cash >= ₹50,000)"
                    placeholder="ABCDE1234F"
                    value={paymentPan}
                    onChange={(e) => {
                      const up = e.target.value.toUpperCase();
                      setPaymentPan(up);
                      const amt = parseFloat(paymentAmount) || 0;
                      const c = validateCashCompliance(amt, up);
                      setCashWarning(c.isValid ? "" : c.errors.join(". "));
                    }}
                    helperText="Section 269ST Income Tax Safeguard"
                  />
                )}
              </div>

              {cashWarning && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-[11px] flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{cashWarning}</span>
                </div>
              )}

              <Input
                label="Payment Notes"
                placeholder="e.g. Advance deposit / settled at check-out"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAdvanceDeposit}
                  onChange={(e) => setIsAdvanceDeposit(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-slate-300">Tag as Advance Deposit</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsPaymentOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="gold" size="sm" disabled={actionLoading}>
                  {actionLoading ? "Recording..." : "Record Payment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: REFUND PAYMENT */}
      {isRefundOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-400" /> Process Refund
              </h3>
              <button onClick={() => setIsRefundOpen(false)} className="text-slate-400 hover:text-white text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleRefundPayment} className="space-y-4 text-xs">
              <Input
                label="Refund Amount (INR)"
                type="number"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                required
              />

              <Input
                label="Mandatory Reason for Refund *"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Overcharged item / Early departure refund"
                required
              />

              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-[11px]">
                Statutory Notice: Refunding adjustments are permanently logged in the PMS audit log.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsRefundOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="gold" size="sm" disabled={actionLoading}>
                  {actionLoading ? "Processing..." : "Confirm Refund"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: GST TAX INVOICE PREVIEW */}
      <InvoiceModal
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
        invoiceData={invoiceData}
      />
    </div>
  );
}
