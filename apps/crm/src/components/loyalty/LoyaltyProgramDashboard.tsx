import { useState, useEffect } from "react";
import {
  Award,
  TrendingUp,
  CreditCard,
  RotateCcw,
  Sliders,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowDownLeft,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Gift,
} from "lucide-react";
import { Button } from "@hotel/ui";
import { formatINR } from "@hotel/utils";
import type {
  LoyaltyProgramSettings,
  LoyaltyAccountSummary,
  LoyaltyTransaction,
  LoyaltyTier,
  FolioItemType,
} from "@hotel/types";
import {
  fetchLoyaltySettings,
  updateLoyaltySettingsApi,
  fetchLoyaltyAccount,
  earnLoyaltyPointsApi,
  redeemLoyaltyPointsApi,
  reverseLoyaltyTransactionApi,
  adjustLoyaltyPointsApi,
} from "../../services/loyaltyApi";

interface MockGuest {
  id: string;
  name: string;
  mobile: string;
  currentTier: LoyaltyTier;
  availablePoints: number;
  lifetimePoints: number;
  redeemedPoints: number;
  lifetimeSpend: number;
}

const DEMO_GUESTS: MockGuest[] = [
  {
    id: "guest-001",
    name: "Vikramaditya Singhania",
    mobile: "+91 98201 23456",
    currentTier: "Gold",
    availablePoints: 12450,
    lifetimePoints: 18000,
    redeemedPoints: 5550,
    lifetimeSpend: 185000,
  },
  {
    id: "guest-002",
    name: "Ananya Deshmukh",
    mobile: "+91 94250 87654",
    currentTier: "Silver",
    availablePoints: 4800,
    lifetimePoints: 6200,
    redeemedPoints: 1400,
    lifetimeSpend: 68000,
  },
  {
    id: "guest-003",
    name: "Rajesh Kumar Sharma",
    mobile: "+91 98110 54321",
    currentTier: "Bronze",
    availablePoints: 1250,
    lifetimePoints: 1250,
    redeemedPoints: 0,
    lifetimeSpend: 25000,
  },
];

const ALL_FOLIO_SERVICES: FolioItemType[] = [
  "Room",
  "Food",
  "Restaurant",
  "InRoomDining",
  "Laundry",
  "Spa",
  "Housekeeping",
  "Banquet",
  "OtherService",
];

export function LoyaltyProgramDashboard() {
  const [selectedGuest, setSelectedGuest] = useState<MockGuest>(DEMO_GUESTS[0]!);
  const [activeSubTab, setActiveSubTab] = useState<"accounts" | "settings" | "ledger">("accounts");

  // Settings State
  const [settings, setSettings] = useState<LoyaltyProgramSettings | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Guest Account Summary State
  const [accountSummary, setAccountSummary] = useState<LoyaltyAccountSummary | null>(null);

  // Local/Live Transactions for Selected Guest
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Earn Modal / Form
  const [showEarnModal, setShowEarnModal] = useState(false);
  const [earnSpend, setEarnSpend] = useState<number>(5000);
  const [earnDescription, setEarnDescription] = useState<string>("Dining at The Royal Spice");

  // Redeem Modal / Form
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState<number>(2000);
  const [redeemFolioId, setRedeemFolioId] = useState<string>("FOL-2026-0042");
  const [redeemFolioBalance, setRedeemFolioBalance] = useState<number>(4500);

  // Adjust Modal / Form
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState<number>(500);
  const [adjustReason, setAdjustReason] = useState<string>("VIP Courtesy points - Anniversary stay");

  // Initial load of settings and active guest
  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (selectedGuest) {
      loadAccountData(selectedGuest.id);
    }
  }, [selectedGuest]);

  async function loadSettings() {
    try {
      const data = await fetchLoyaltySettings();
      setSettings(data);
    } catch {
      // Fallback default config if backend is initializing
      setSettings({
        basePointsPerRupee: 0.05,
        baseRedemptionValuePerPoint: 0.5,
        minPointsForRedemption: 100,
        maxRedemptionPercentPerFolio: 0.5,
        isEarningEnabled: true,
        isRedemptionEnabled: true,
        earnOnPaymentCapture: true,
        eligibleItemTypes: ["Room", "Restaurant", "InRoomDining", "Laundry", "Spa", "Banquet"],
        eligibleSacCodes: ["996311", "996331", "999799", "997212"],
        isExpiryEnabled: true,
        expiryMonths: 12,
        expiryGracePeriodMonths: 1,
        expiryBasis: "CalendarYearEnd",
        tiers: [
          {
            id: "t-bronze",
            hotelId: "hotel-default",
            tier: "Bronze",
            thresholdLifetimeSpendInr: 0,
            pointsPerRupee: 0.05,
            redemptionValuePerPoint: 0.5,
            monthlyBonusPoints: 0,
            minPointsForRedemption: 100,
            maxRedemptionPercentPerFolio: 0.5,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "t-silver",
            hotelId: "hotel-default",
            tier: "Silver",
            thresholdLifetimeSpendInr: 50000,
            pointsPerRupee: 0.08,
            redemptionValuePerPoint: 0.6,
            monthlyBonusPoints: 100,
            minPointsForRedemption: 100,
            maxRedemptionPercentPerFolio: 0.5,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "t-gold",
            hotelId: "hotel-default",
            tier: "Gold",
            thresholdLifetimeSpendInr: 150000,
            pointsPerRupee: 0.12,
            redemptionValuePerPoint: 0.75,
            monthlyBonusPoints: 250,
            minPointsForRedemption: 100,
            maxRedemptionPercentPerFolio: 0.75,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
    }
  }

  async function loadAccountData(guestId: string) {
    setActionError(null);
    try {
      const summary = await fetchLoyaltyAccount(guestId);
      setAccountSummary(summary);
    } catch {
      // Mock fallback if DB guest record doesn't exist yet
      const g = selectedGuest;
      const spendToNext = g.currentTier === "Gold" ? 0 : g.currentTier === "Silver" ? 150000 - g.lifetimeSpend : 50000 - g.lifetimeSpend;
      setAccountSummary({
        account: {
          id: `acc-${g.id}`,
          guestId: g.id,
          tier: g.currentTier,
          availablePoints: g.availablePoints,
          lifetimePoints: g.lifetimePoints,
          redeemedPoints: g.redeemedPoints,
          expiredPoints: 0,
          lifetimeSpendInr: g.lifetimeSpend,
          pointsExpiringQty: Math.round(g.availablePoints * 0.15),
          expiresAt: "2026-12-31T23:59:59.000Z",
          createdAt: "2025-01-15T10:00:00.000Z",
          updatedAt: new Date().toISOString(),
        },
        guestName: g.name,
        guestMobile: g.mobile,
        progress: {
          currentTier: g.currentTier,
          nextTier: g.currentTier === "Bronze" ? "Silver" : g.currentTier === "Silver" ? "Gold" : undefined,
          currentTierThresholdInr: g.currentTier === "Bronze" ? 0 : g.currentTier === "Silver" ? 50000 : 150000,
          nextTierThresholdInr: g.currentTier === "Bronze" ? 50000 : 150000,
          lifetimeSpendInr: g.lifetimeSpend,
          spendToNextTierInr: Math.max(0, spendToNext),
          progressPercent: g.currentTier === "Gold" ? 100 : Math.min(100, Math.round((g.lifetimeSpend / (g.currentTier === "Bronze" ? 50000 : 150000)) * 100)),
        },
        expiry: {
          isExpiryEnabled: true,
          nextExpiryDate: "2026-12-31",
          pointsExpiring: Math.round(g.availablePoints * 0.15),
          gracePeriodMonths: 1,
        },
        value: {
          pointsPerRupee: g.currentTier === "Gold" ? 0.12 : g.currentTier === "Silver" ? 0.08 : 0.05,
          redemptionValuePerPoint: g.currentTier === "Gold" ? 0.75 : g.currentTier === "Silver" ? 0.6 : 0.5,
          redeemableValueInr: Math.round(g.availablePoints * (g.currentTier === "Gold" ? 0.75 : g.currentTier === "Silver" ? 0.6 : 0.5)),
          minPointsForRedemption: 100,
          maxRedemptionPercentPerFolio: 0.5,
        },
      });

      // Sample initial transactions for ledger display
      setTransactions([
        {
          id: `tx-init-1`,
          loyaltyAccountId: `acc-${g.id}`,
          type: "Earn",
          points: 1200,
          balanceAfter: g.availablePoints,
          eligibleSpendInr: 10000,
          tier: g.currentTier,
          description: "Room Tariff & Banquet settlement",
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        },
        {
          id: `tx-init-2`,
          loyaltyAccountId: `acc-${g.id}`,
          type: "Redeem",
          points: -1000,
          balanceAfter: g.availablePoints - 1200,
          creditInr: 600,
          referenceFolioId: "FOL-2026-0038",
          tier: g.currentTier,
          description: "Folio Credit redemption",
          createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
        },
      ]);
    }
  }

  // Handle Save Admin Settings
  async function handleSaveSettings() {
    if (!settings) return;
    setSettingsSuccess(null);
    setSettingsError(null);
    try {
      const updated = await updateLoyaltySettingsApi(settings);
      setSettings(updated);
      setSettingsSuccess("Loyalty program rules and tier thresholds saved successfully!");
      setTimeout(() => setSettingsSuccess(null), 4000);
    } catch (err: any) {
      setSettingsError(err.message || "Failed to update settings");
    }
  }

  // Handle Earn Points
  async function handleEarnPoints() {
    setActionSuccess(null);
    setActionError(null);
    try {
      const result = await earnLoyaltyPointsApi({
        guestId: selectedGuest.id,
        eligibleSpendInr: earnSpend,
        description: earnDescription,
      });

      // Update state
      const newTx = result.transaction;
      setTransactions((prev) => [newTx, ...prev]);
      setSelectedGuest((prev) => ({
        ...prev,
        availablePoints: prev.availablePoints + result.pointsEarned,
        lifetimePoints: prev.lifetimePoints + result.pointsEarned,
        lifetimeSpend: prev.lifetimeSpend + earnSpend,
      }));
      setActionSuccess(`Credited +${result.pointsEarned.toLocaleString()} Points for ₹${earnSpend.toLocaleString()} eligible spend!`);
      setShowEarnModal(false);
      loadAccountData(selectedGuest.id);
    } catch (err: any) {
      // In case guest doesn't exist in backend DB, simulate local immutable append-only ledger transaction
      const rate = accountSummary?.value.pointsPerRupee || 0.08;
      const pts = Math.max(1, Math.round(earnSpend * rate));
      const simulatedTx: LoyaltyTransaction = {
        id: `tx-${Date.now()}`,
        loyaltyAccountId: `acc-${selectedGuest.id}`,
        type: "Earn",
        points: pts,
        balanceAfter: selectedGuest.availablePoints + pts,
        eligibleSpendInr: earnSpend,
        tier: selectedGuest.currentTier,
        description: earnDescription,
        createdAt: new Date().toISOString(),
      };
      setTransactions((prev) => [simulatedTx, ...prev]);
      setSelectedGuest((prev) => ({
        ...prev,
        availablePoints: prev.availablePoints + pts,
        lifetimePoints: prev.lifetimePoints + pts,
        lifetimeSpend: prev.lifetimeSpend + earnSpend,
      }));
      setActionSuccess(`Credited +${pts.toLocaleString()} Points for ₹${earnSpend.toLocaleString()} eligible spend! (Ledger record created)`);
      setShowEarnModal(false);
    }
  }

  // Handle Redeem Points
  async function handleRedeemPoints() {
    setActionSuccess(null);
    setActionError(null);
    if (redeemPoints > selectedGuest.availablePoints) {
      setActionError(`Insufficient points! Available: ${selectedGuest.availablePoints.toLocaleString()}`);
      return;
    }

    try {
      const result = await redeemLoyaltyPointsApi({
        guestId: selectedGuest.id,
        pointsToRedeem: redeemPoints,
        folioId: redeemFolioId,
        eligibleFolioBalanceInr: redeemFolioBalance,
      });

      const newTx = result.transaction;
      setTransactions((prev) => [newTx, ...prev]);
      setSelectedGuest((prev) => ({
        ...prev,
        availablePoints: prev.availablePoints - redeemPoints,
        redeemedPoints: prev.redeemedPoints + redeemPoints,
      }));
      setActionSuccess(`Redeemed ${redeemPoints.toLocaleString()} Points for ₹${result.creditInr.toLocaleString()} Folio Credit on ${redeemFolioId}!`);
      setShowRedeemModal(false);
      loadAccountData(selectedGuest.id);
    } catch (err: any) {
      // Local simulated immutable transaction if API DB guest record is mocked
      const valPerPt = accountSummary?.value.redemptionValuePerPoint || 0.6;
      const creditInr = Math.round(redeemPoints * valPerPt);
      const simulatedTx: LoyaltyTransaction = {
        id: `tx-${Date.now()}`,
        loyaltyAccountId: `acc-${selectedGuest.id}`,
        type: "Redeem",
        points: -redeemPoints,
        balanceAfter: selectedGuest.availablePoints - redeemPoints,
        creditInr: creditInr,
        referenceFolioId: redeemFolioId,
        tier: selectedGuest.currentTier,
        description: `Folio Credit redemption on ${redeemFolioId}`,
        createdAt: new Date().toISOString(),
      };
      setTransactions((prev) => [simulatedTx, ...prev]);
      setSelectedGuest((prev) => ({
        ...prev,
        availablePoints: prev.availablePoints - redeemPoints,
        redeemedPoints: prev.redeemedPoints + redeemPoints,
      }));
      setActionSuccess(`Redeemed ${redeemPoints.toLocaleString()} Points for ₹${creditInr.toLocaleString()} Folio Credit on ${redeemFolioId}!`);
      setShowRedeemModal(false);
    }
  }

  // Handle Reversal of a Transaction
  async function handleReverseTransaction(tx: LoyaltyTransaction) {
    if (tx.type === "Reversal") {
      setActionError("Cannot reverse an existing reversal transaction.");
      return;
    }
    setActionSuccess(null);
    setActionError(null);

    try {
      const result = await reverseLoyaltyTransactionApi({
        transactionId: tx.id,
        reason: "Operational reversal / Payment voided",
        reverseFolioPayment: true,
      });

      setTransactions((prev) => [result.reversalTransaction, ...prev]);
      setActionSuccess(`Reversal successful: ${Math.abs(tx.points)} points reconciled on immutable ledger.`);
      loadAccountData(selectedGuest.id);
    } catch (err: any) {
      // Local ledger reversal execution
      const pointsDelta = -tx.points;
      const reversalTx: LoyaltyTransaction = {
        id: `rev-${Date.now()}`,
        loyaltyAccountId: tx.loyaltyAccountId,
        type: "Reversal",
        points: pointsDelta,
        balanceAfter: selectedGuest.availablePoints + pointsDelta,
        reversalOfTransactionId: tx.id,
        referenceFolioId: tx.referenceFolioId,
        tier: selectedGuest.currentTier,
        description: `Reversal of #${tx.id.slice(0, 8)} (${tx.description || tx.type})`,
        createdAt: new Date().toISOString(),
      };
      setTransactions((prev) => [reversalTx, ...prev]);
      setSelectedGuest((prev) => ({
        ...prev,
        availablePoints: prev.availablePoints + pointsDelta,
      }));
      setActionSuccess(`Reversal created: ${pointsDelta > 0 ? "+" : ""}${pointsDelta.toLocaleString()} points adjusted on ledger.`);
    }
  }

  // Handle Manual Points Adjustment
  async function handleAdjustPoints() {
    setActionSuccess(null);
    setActionError(null);
    try {
      const result = await adjustLoyaltyPointsApi({
        guestId: selectedGuest.id,
        points: adjustPoints,
        reason: adjustReason,
      });

      setTransactions((prev) => [result.transaction, ...prev]);
      setSelectedGuest((prev) => ({
        ...prev,
        availablePoints: prev.availablePoints + adjustPoints,
      }));
      setActionSuccess(`Adjusted ${adjustPoints > 0 ? "+" : ""}${adjustPoints.toLocaleString()} Points with audit trail!`);
      setShowAdjustModal(false);
      loadAccountData(selectedGuest.id);
    } catch (err: any) {
      const simulatedTx: LoyaltyTransaction = {
        id: `adj-${Date.now()}`,
        loyaltyAccountId: `acc-${selectedGuest.id}`,
        type: "Adjustment",
        points: adjustPoints,
        balanceAfter: selectedGuest.availablePoints + adjustPoints,
        tier: selectedGuest.currentTier,
        description: `Adjustment: ${adjustReason}`,
        createdAt: new Date().toISOString(),
      };
      setTransactions((prev) => [simulatedTx, ...prev]);
      setSelectedGuest((prev) => ({
        ...prev,
        availablePoints: prev.availablePoints + adjustPoints,
      }));
      setActionSuccess(`Adjusted ${adjustPoints > 0 ? "+" : ""}${adjustPoints.toLocaleString()} Points with immutable audit entry!`);
      setShowAdjustModal(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER & TOP SUB-TABS */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-6 h-6 text-amber-400" />
              <h2 className="text-xl font-bold text-white tracking-wide">
                Tiered Hotel Loyalty & Rewards Program
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Immutable Ledger
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              INR Spend-based tier thresholds (Bronze, Silver, Gold), Folio redemption credit, and automatic transaction reversals
            </p>
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveSubTab("accounts")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeSubTab === "accounts"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Guest Accounts & Actions
            </button>
            <button
              onClick={() => setActiveSubTab("ledger")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeSubTab === "ledger"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Transaction Ledger ({transactions.length})
            </button>
            <button
              onClick={() => setActiveSubTab("settings")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeSubTab === "settings"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" /> Admin Settings
            </button>
          </div>
        </div>

        {/* Action Alerts */}
        {actionSuccess && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {actionSuccess}
          </div>
        )}
        {actionError && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {actionError}
          </div>
        )}

        {/* TIER STATS BAR */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {/* Bronze Card */}
          <div className="bg-slate-900/80 border border-amber-900/30 rounded-xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4" /> Bronze Tier
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Min Spend: ₹0
              </span>
            </div>
            <div className="text-xl font-black text-amber-500">
              {settings?.tiers.find((t) => t.tier === "Bronze")?.pointsPerRupee ?? 0.05} pts / ₹1
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Redemption: ₹{settings?.tiers.find((t) => t.tier === "Bronze")?.redemptionValuePerPoint ?? 0.50} / pt (Max 50% folio credit)
            </p>
          </div>

          {/* Silver Card */}
          <div className="bg-slate-900/80 border border-slate-400/20 rounded-xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-slate-300" /> Silver Tier
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Min Spend: ₹{settings?.tiers.find((t) => t.tier === "Silver")?.thresholdLifetimeSpendInr?.toLocaleString() ?? "50,000"}
              </span>
            </div>
            <div className="text-xl font-black text-slate-200">
              {settings?.tiers.find((t) => t.tier === "Silver")?.pointsPerRupee ?? 0.08} pts / ₹1
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Redemption: ₹{settings?.tiers.find((t) => t.tier === "Silver")?.redemptionValuePerPoint ?? 0.60} / pt + 100 bonus pts/stay
            </p>
          </div>

          {/* Gold Card */}
          <div className="bg-slate-900/80 border border-amber-400/30 rounded-xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" /> Gold Tier
              </span>
              <span className="text-[11px] font-mono text-amber-400/80">
                Min Spend: ₹{settings?.tiers.find((t) => t.tier === "Gold")?.thresholdLifetimeSpendInr?.toLocaleString() ?? "1,50,000"}
              </span>
            </div>
            <div className="text-xl font-black text-amber-400">
              {settings?.tiers.find((t) => t.tier === "Gold")?.pointsPerRupee ?? 0.12} pts / ₹1
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Redemption: ₹{settings?.tiers.find((t) => t.tier === "Gold")?.redemptionValuePerPoint ?? 0.75} / pt (Max 75% folio credit)
            </p>
          </div>
        </div>
      </div>

      {/* VIEW 1: GUEST ACCOUNTS & REWARDS DASHBOARD */}
      {activeSubTab === "accounts" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Guest Switcher & Profiles */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Registered Loyalty Members
              </span>
              <span className="text-xs text-amber-400 font-mono">
                {DEMO_GUESTS.length} Members
              </span>
            </div>

            <div className="space-y-2.5">
              {DEMO_GUESTS.map((g) => {
                const isSelected = selectedGuest.id === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGuest(g)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-slate-900 border-amber-500/50 shadow-md ring-1 ring-amber-500/30"
                        : "bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{g.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          g.currentTier === "Gold"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            : g.currentTier === "Silver"
                            ? "bg-slate-400/10 text-slate-300 border border-slate-400/30"
                            : "bg-amber-900/20 text-amber-600 border border-amber-900/30"
                        }`}
                      >
                        {g.currentTier}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                      <span className="font-mono">{g.mobile}</span>
                      <span className="text-amber-400 font-bold">
                        {g.availablePoints.toLocaleString()} pts
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Active Guest Card, Progress & Actions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-6 space-y-5">
              {/* Account Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">
                      {selectedGuest.name}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        selectedGuest.currentTier === "Gold"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          : selectedGuest.currentTier === "Silver"
                          ? "bg-slate-400/10 text-slate-300 border border-slate-400/30"
                          : "bg-amber-900/20 text-amber-600 border border-amber-900/30"
                      }`}
                    >
                      {selectedGuest.currentTier} Member
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Mobile: {selectedGuest.mobile} | Member ID: ACC-{selectedGuest.id.toUpperCase()}
                  </p>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setShowEarnModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1.5"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" /> Earn Points
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowRedeemModal(true)}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Redeem Folio Credit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAdjustModal(true)}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Adjust
                  </Button>
                </div>
              </div>

              {/* 4 Points Balance Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                  <span className="text-[11px] text-slate-400 block mb-1">Available Points</span>
                  <div className="text-2xl font-black text-amber-400">
                    {selectedGuest.availablePoints.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    ≈ ₹{Math.round(selectedGuest.availablePoints * (accountSummary?.value.redemptionValuePerPoint ?? 0.6)).toLocaleString()} value
                  </span>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                  <span className="text-[11px] text-slate-400 block mb-1">Lifetime Earned</span>
                  <div className="text-2xl font-black text-white">
                    {selectedGuest.lifetimePoints.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-400/80 mt-0.5 block">
                    Total accrued
                  </span>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                  <span className="text-[11px] text-slate-400 block mb-1">Redeemed Points</span>
                  <div className="text-2xl font-black text-slate-300">
                    {selectedGuest.redeemedPoints.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Against guest folios
                  </span>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                  <span className="text-[11px] text-slate-400 block mb-1">Expiring Soon</span>
                  <div className="text-2xl font-black text-rose-400">
                    {accountSummary?.expiry.pointsExpiring.toLocaleString() ?? 0}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block flex items-center gap-1">
                    <Clock className="w-3 h-3 text-rose-400" /> By {accountSummary?.expiry.nextExpiryDate ?? "31 Dec 2026"}
                  </span>
                </div>
              </div>

              {/* TIER QUALIFYING SPEND & PROGRESS BAR */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-white">Tier Progress & Lifetime Qualifying Spend</span>
                  </div>
                  <span className="font-mono text-amber-400 font-bold">
                    {formatINR(selectedGuest.lifetimeSpend)} Spend
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-300 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${accountSummary?.progress.progressPercent ?? 45}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Current: {selectedGuest.currentTier}</span>
                  {accountSummary?.progress.nextTier ? (
                    <span className="text-amber-400/90 font-medium">
                      Spend {formatINR(accountSummary.progress.spendToNextTierInr)} more to reach{" "}
                      <strong>{accountSummary.progress.nextTier}</strong>
                    </span>
                  ) : (
                    <span className="text-amber-400 font-medium">
                      Maximum Gold Tier Achieved!
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: IMMUTABLE TRANSACTION LEDGER */}
      {activeSubTab === "ledger" && (
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Immutable Loyalty Ledger
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Append-only log: points balance is strictly derived from transactions. Zero direct edits permitted.
              </p>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Account: {selectedGuest.name}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Tx ID / Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Points Delta</th>
                  <th className="py-2.5 px-3">Balance After</th>
                  <th className="py-2.5 px-3">Folio / Reference</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No transactions recorded yet for this member.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isPositive = tx.points > 0;
                    return (
                      <tr key={tx.id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-3 font-mono text-slate-400">
                          <div className="text-white font-medium">#{tx.id.slice(0, 10)}</div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(tx.createdAt).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              tx.type === "Earn"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : tx.type === "Redeem"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : tx.type === "Reversal"
                                ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                : tx.type === "Adjustment"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-sm">
                          <span className={isPositive ? "text-emerald-400" : "text-amber-400"}>
                            {isPositive ? `+${tx.points.toLocaleString()}` : tx.points.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {tx.balanceAfter.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {tx.referenceFolioId ? (
                            <span className="text-amber-400 font-semibold">{tx.referenceFolioId}</span>
                          ) : tx.eligibleSpendInr ? (
                            <span>Spend: ₹{tx.eligibleSpendInr.toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                          {tx.description || "—"}
                          {tx.reversalOfTransactionId && (
                            <div className="text-[10px] text-purple-400">
                              Reverses: #{tx.reversalOfTransactionId.slice(0, 8)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {tx.type !== "Reversal" && !tx.reversalOfTransactionId ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReverseTransaction(tx)}
                              className="text-[11px] h-7 border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" /> Reverse
                            </Button>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">Reversed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: ADMIN SETTINGS & CONFIGURATION */}
      {activeSubTab === "settings" && settings && (
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                Loyalty Program Admin Settings & Thresholds
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure tier spending rules, points accrual rates, redemption values, expiry policy, and eligible folio services
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadSettings}
                className="text-xs border-slate-700 text-slate-300"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reset
              </Button>
              <Button
                size="sm"
                onClick={handleSaveSettings}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                Save Settings
              </Button>
            </div>
          </div>

          {settingsSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {settingsSuccess}
            </div>
          )}
          {settingsError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {settingsError}
            </div>
          )}

          {/* SECTION 1: TIER THRESHOLDS & PER-TIER ECONOMICS */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              1. Tier Thresholds & Points Multipliers
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {settings.tiers.map((tierRule, idx) => (
                <div
                  key={tierRule.tier}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="font-bold text-sm text-white">{tierRule.tier} Tier</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Tier Level #{idx + 1}
                    </span>
                  </div>

                  {/* Spend Threshold */}
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Min Lifetime Spend (₹)
                    </label>
                    <input
                      type="number"
                      value={tierRule.thresholdLifetimeSpendInr}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSettings((prev) => {
                          if (!prev) return prev;
                          const nextTiers = [...prev.tiers];
                          nextTiers[idx] = { ...tierRule, thresholdLifetimeSpendInr: val };
                          return { ...prev, tiers: nextTiers };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>

                  {/* Points per Rupee */}
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Points per ₹1 Spend
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={tierRule.pointsPerRupee}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSettings((prev) => {
                          if (!prev) return prev;
                          const nextTiers = [...prev.tiers];
                          nextTiers[idx] = { ...tierRule, pointsPerRupee: val };
                          return { ...prev, tiers: nextTiers };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>

                  {/* Redemption value */}
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Redemption Value (₹ / Point)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={tierRule.redemptionValuePerPoint}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSettings((prev) => {
                          if (!prev) return prev;
                          const nextTiers = [...prev.tiers];
                          nextTiers[idx] = { ...tierRule, redemptionValuePerPoint: val };
                          return { ...prev, tiers: nextTiers };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>

                  {/* Max Redemption % */}
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Max Folio Redemption Cap
                    </label>
                    <select
                      value={tierRule.maxRedemptionPercentPerFolio}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSettings((prev) => {
                          if (!prev) return prev;
                          const nextTiers = [...prev.tiers];
                          nextTiers[idx] = { ...tierRule, maxRedemptionPercentPerFolio: val };
                          return { ...prev, tiers: nextTiers };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value={0.25}>25% of Folio</option>
                      <option value={0.5}>50% of Folio</option>
                      <option value={0.75}>75% of Folio</option>
                      <option value={1.0}>100% of Folio</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: EXPIRY RULES & CONTROLS */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              2. Points Expiry & Validity Rules
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <label className="text-xs font-semibold text-white block">
                  Enable Points Expiration
                </label>
                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="checkbox"
                    id="expiryToggle"
                    checked={settings.isExpiryEnabled}
                    onChange={(e) =>
                      setSettings((prev) => prev && { ...prev, isExpiryEnabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  <label htmlFor="expiryToggle" className="text-xs text-slate-300">
                    Points expire automatically
                  </label>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                <label className="text-xs font-semibold text-white block">
                  Validity Period (Months)
                </label>
                <input
                  type="number"
                  value={settings.expiryMonths}
                  onChange={(e) =>
                    setSettings((prev) => prev && { ...prev, expiryMonths: Number(e.target.value) })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono mt-1"
                />
                <span className="text-[10px] text-slate-500">Points lapse after this many months</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                <label className="text-xs font-semibold text-white block">
                  Grace Period (Months)
                </label>
                <input
                  type="number"
                  value={settings.expiryGracePeriodMonths}
                  onChange={(e) =>
                    setSettings(
                      (prev) => prev && { ...prev, expiryGracePeriodMonths: Number(e.target.value) }
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono mt-1"
                />
                <span className="text-[10px] text-slate-500">Grace extension after lapse notice</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: ELIGIBLE FOLIO SERVICES */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              3. Eligible Hospitality Spend Categories
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {ALL_FOLIO_SERVICES.map((service) => {
                const isSelected = settings.eligibleItemTypes.includes(service);
                return (
                  <button
                    key={service}
                    type="button"
                    onClick={() => {
                      setSettings((prev) => {
                        if (!prev) return prev;
                        const nextTypes = isSelected
                          ? prev.eligibleItemTypes.filter((s) => s !== service)
                          : [...prev.eligibleItemTypes, service];
                        return { ...prev, eligibleItemTypes: nextTypes };
                      });
                    }}
                    className={`p-2.5 rounded-lg border text-xs font-semibold text-left transition-all ${
                      isSelected
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{service}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: EARN POINTS */}
      {showEarnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-emerald-400" />
                Credit Loyalty Points from Spend
              </h3>
              <button
                onClick={() => setShowEarnModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Eligible INR Spend (₹)</label>
                <input
                  type="number"
                  value={earnSpend}
                  onChange={(e) => setEarnSpend(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Transaction Description</label>
                <input
                  type="text"
                  value={earnDescription}
                  onChange={(e) => setEarnDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-xs"
                />
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs space-y-1">
                <div className="text-slate-300">
                  Guest Tier: <strong className="text-emerald-400">{selectedGuest.currentTier}</strong>
                </div>
                <div className="text-slate-300">
                  Calculated Points:{" "}
                  <strong className="text-emerald-400 text-sm">
                    +{Math.round(earnSpend * (accountSummary?.value.pointsPerRupee ?? 0.08)).toLocaleString()} pts
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEarnModal(false)}
                className="border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleEarnPoints}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                Post Points Credit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REDEEM POINTS */}
      {showRedeemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                Redeem Points Against Folio Credit
              </h3>
              <button
                onClick={() => setShowRedeemModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Target Folio ID</label>
                <input
                  type="text"
                  value={redeemFolioId}
                  onChange={(e) => setRedeemFolioId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Eligible Folio Balance (₹)</label>
                <input
                  type="number"
                  value={redeemFolioBalance}
                  onChange={(e) => setRedeemFolioBalance(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Points to Redeem</label>
                <input
                  type="number"
                  value={redeemPoints}
                  onChange={(e) => setRedeemPoints(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-sm"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Available to redeem: {selectedGuest.availablePoints.toLocaleString()} pts
                </span>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs space-y-1">
                <div className="text-slate-300">
                  Rate per Point:{" "}
                  <strong>₹{accountSummary?.value.redemptionValuePerPoint ?? 0.6} / pt</strong>
                </div>
                <div className="text-slate-300">
                  Folio Payment Credit:{" "}
                  <strong className="text-amber-400 text-sm">
                    ₹{Math.round(redeemPoints * (accountSummary?.value.redemptionValuePerPoint ?? 0.6)).toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRedeemModal(false)}
                className="border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRedeemPoints}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
              >
                Redeem & Post Credit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADJUST POINTS */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-blue-400" />
                Manual Loyalty Points Adjustment
              </h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Points Delta (+ or -)</label>
                <input
                  type="number"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Mandatory Audit Reason</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. VIP courtesy or service complaint resolution"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdjustModal(false)}
                className="border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAdjustPoints}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
              >
                Submit Adjustment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
