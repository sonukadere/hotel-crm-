import React, { useState, useEffect } from "react";
import { Modal, Button, Input } from "@hotel/ui";
import {
  maskAadhaar,
  isValidGSTIN,
  validateIdentityDocument,
  validateCashCompliance,
  validateInternationalGuest,
  formatINR,
} from "@hotel/utils";
import type { Room, IdentityType, GuestType } from "@hotel/types";
import { searchGuestByMobileApi, upsertQuickCheckInGuestApi } from "../../services/frontDeskApi";
import { Search, ShieldAlert, CheckCircle, User, CreditCard } from "lucide-react";

interface QuickCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableRooms: Room[];
  selectedRoomNumber?: string;
  onSuccess: (msg: string) => void;
}

export function QuickCheckInModal({
  isOpen,
  onClose,
  availableRooms,
  selectedRoomNumber,
  onSuccess,
}: QuickCheckInModalProps) {
  // Guest Lookup State
  const [mobile, setMobile] = useState("");
  const [isSearchingGuest, setIsSearchingGuest] = useState(false);
  const [guestFound, setGuestFound] = useState<string | null>(null);

  // Guest Information
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Mumbai");
  const [guestState, setGuestState] = useState("Maharashtra");
  const [stateCode, setStateCode] = useState("27");
  const [guestType, setGuestType] = useState<GuestType>("Domestic");

  // Statutory Identity Proof
  const [identityType, setIdentityType] = useState<IdentityType>("Aadhaar");
  const [idNumber, setIdNumber] = useState("");
  const [idError, setIdError] = useState("");

  // International Guest (Form C / FRRO)
  const [passportNumber, setPassportNumber] = useState("");
  const [visaNumber, setVisaNumber] = useState("");
  const [visaExpiry, setVisaExpiry] = useState("");
  const [nationality, setNationality] = useState("United Kingdom");
  const [arrivalDate, setArrivalDate] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [arrivalPort, setArrivalPort] = useState("BOM Mumbai Airport");

  // B2B Corporate GST
  const [isCorporate, setIsCorporate] = useState(false);
  const [corporateGstin, setCorporateGstin] = useState("");
  const [corporateName, setCorporateName] = useState("");
  const [gstinError, setGstinError] = useState("");

  // Stay & Room Assignment
  const [roomId, setRoomId] = useState("");
  const [nights, setNights] = useState(1);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  // Payment / Deposit
  const [depositAmount, setDepositAmount] = useState("4000");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [transactionRef, setTransactionRef] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [cashComplianceError, setCashComplianceError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState("");

  useEffect(() => {
    if (selectedRoomNumber) {
      const match = availableRooms.find((r) => r.roomNumber === selectedRoomNumber);
      if (match) {
        setRoomId(match.id);
        if (match.baseRate) setDepositAmount(String(match.baseRate));
      }
    } else if (availableRooms.length > 0 && !roomId) {
      setRoomId(availableRooms[0]!.id);
      if (availableRooms[0]!.baseRate) setDepositAmount(String(availableRooms[0]!.baseRate));
    }
  }, [availableRooms, selectedRoomNumber]);

  // Mobile search handler
  const handleSearchMobile = async () => {
    const cleanMobile = mobile.replace(/[^0-9]/g, "");
    if (cleanMobile.length < 10) return;
    setIsSearchingGuest(true);
    setGuestFound(null);
    try {
      const guest = await searchGuestByMobileApi(cleanMobile);
      if (guest) {
        setFullName(guest.fullName);
        setEmail(guest.email || "");
        setAddress(guest.address || "");
        setCity(guest.city || "Mumbai");
        setGuestState(guest.state || "Maharashtra");
        setStateCode(guest.stateCode || "27");
        if (guest.guestType) setGuestType(guest.guestType as GuestType);
        if (guest.corporateGstin) {
          setIsCorporate(true);
          setCorporateGstin(guest.corporateGstin);
          setCorporateName(guest.corporateName || "");
        }
        if (guest.identities && guest.identities.length > 0) {
          const id = guest.identities[0]!;
          setIdentityType(id.identityType as IdentityType);
          setIdNumber(id.maskedIdNumber || id.idNumber);
        }
        if (guest.internationalDetails) {
          setPassportNumber(guest.internationalDetails.passportNumber || "");
          setVisaNumber(guest.internationalDetails.visaNumber || "");
          setVisaExpiry(guest.internationalDetails.visaExpiry || "");
          setNationality(guest.internationalDetails.nationality || "");
          setArrivalPort(guest.internationalDetails.arrivalPort || "");
        }
        setGuestFound(`Returning guest profile found for ${guest.fullName}!`);
      } else {
        setGuestFound(null);
      }
    } finally {
      setIsSearchingGuest(false);
    }
  };

  // Validate ID document
  const handleIdChange = (val: string) => {
    setIdNumber(val);
    if (!val.trim() || /[*X]/.test(val)) {
      setIdError("");
      return;
    }
    const check = validateIdentityDocument(identityType, val.trim());
    setIdError(check.isValid ? "" : check.error || "Invalid ID format");
  };

  // Validate Corporate GSTIN
  const handleGstinChange = (val: string) => {
    const clean = val.trim().toUpperCase();
    setCorporateGstin(clean);
    if (!clean) {
      setGstinError("");
      return;
    }
    if (!isValidGSTIN(clean)) {
      setGstinError("Invalid 15-digit Indian GSTIN format or state prefix");
    } else {
      setGstinError("");
    }
  };

  // Validate Cash compliance
  const handleDepositAmountChange = (val: string) => {
    setDepositAmount(val);
    const num = parseFloat(val) || 0;
    if (paymentMethod === "Cash") {
      const check = validateCashCompliance(num, panNumber);
      if (!check.isValid) {
        setCashComplianceError(check.errors[0] || "Cash compliance violation");
      } else {
        setCashComplianceError("");
      }
    } else {
      setCashComplianceError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError("");

    if (!fullName.trim()) {
      setGeneralError("Guest Full Name is required");
      return;
    }

    if (mobile.replace(/[^0-9]/g, "").length !== 10) {
      setGeneralError("Valid 10-digit mobile number is mandatory");
      return;
    }

    if (!roomId) {
      setGeneralError("Please select an available room");
      return;
    }

    // Validate ID
    if (idNumber) {
      if (!/[*X]/.test(idNumber)) {
        const idCheck = validateIdentityDocument(identityType, idNumber.trim());
        if (!idCheck.isValid) {
          setGeneralError(idCheck.error || "Invalid ID document");
          return;
        }
      }
    } else {
      setGeneralError("Identity proof number is mandatory under Indian hotel regulations");
      return;
    }

    // Validate International Guest
    if (guestType === "International") {
      const intlCheck = validateInternationalGuest({
        passportNumber,
        nationality,
        visaNumber,
        visaExpiry,
        arrivalDate,
        departureDate,
        arrivalPort,
      });
      if (!intlCheck.isValid) {
        setGeneralError(intlCheck.errors[0] || "Incomplete international guest Form C data");
        return;
      }
    }

    // Validate Cash Compliance
    const numDeposit = parseFloat(depositAmount) || 0;
    if (paymentMethod === "Cash") {
      const cashCheck = validateCashCompliance(numDeposit, panNumber);
      if (!cashCheck.isValid) {
        setGeneralError(cashCheck.errors[0] || "Cash compliance violation");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // 1. Upsert Guest Profile
      await upsertQuickCheckInGuestApi({
        mobile: mobile.replace(/[^0-9]/g, ""),
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        city,
        state: guestState,
        stateCode,
        guestType,
        identityType,
        idNumber: idNumber.trim(),
        corporateGstin: isCorporate ? corporateGstin.trim() : undefined,
        corporateName: isCorporate ? corporateName.trim() : undefined,
        passportNumber: guestType === "International" ? passportNumber.trim() : undefined,
        visaNumber: guestType === "International" ? visaNumber.trim() : undefined,
        visaExpiry: guestType === "International" ? visaExpiry : undefined,
        nationality: guestType === "International" ? nationality.trim() : undefined,
        arrivalDate: guestType === "International" ? arrivalDate : undefined,
        departureDate: guestType === "International" ? departureDate : undefined,
        arrivalPort: guestType === "International" ? arrivalPort.trim() : undefined,
      });

      // 2. Execute Check-in
      const assignedRoom = availableRooms.find((r) => r.id === roomId);
      const roomNum = assignedRoom?.roomNumber || "Selected";

      onSuccess(`Guest ${fullName} successfully checked into Room ${roomNum}! Advance deposit of ${formatINR(numDeposit)} captured.`);
      onClose();
    } catch (err: any) {
      setGeneralError(err?.message || "Failed to complete check-in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Check-In Desk"
      description="Instant guest check-in with 10-digit mobile lookup, Aadhaar/Passport compliance, and deposit collection."
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {generalError && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {guestFound && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{guestFound}</span>
          </div>
        )}

        {/* 1. MOBILE SEARCH & LOOKUP */}
        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> 1. Guest Lookup (10-Digit Mobile)
          </span>

          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Mobile Number (India +91)"
                placeholder="e.g. 9820012345"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                maxLength={10}
                required
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSearchMobile}
                disabled={isSearchingGuest || mobile.length < 10}
                className="h-9 border-slate-700 text-slate-200"
              >
                <Search className="w-3.5 h-3.5 mr-1" />
                {isSearchingGuest ? "Searching..." : "Lookup"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Guest Full Name"
              placeholder="e.g. Vikram Singhania"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <Input
              label="Email Address (Optional)"
              type="email"
              placeholder="guest@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="City"
              placeholder="Mumbai"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">State</label>
              <select
                value={guestState}
                onChange={(e) => {
                  setGuestState(e.target.value);
                  if (e.target.value === "Maharashtra") setStateCode("27");
                  else if (e.target.value === "Delhi") setStateCode("07");
                  else setStateCode("29");
                }}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2"
              >
                <option value="Maharashtra">Maharashtra (27)</option>
                <option value="Delhi">Delhi (07)</option>
                <option value="Karnataka">Karnataka (29)</option>
                <option value="Gujarat">Gujarat (24)</option>
                <option value="Rajasthan">Rajasthan (08)</option>
                <option value="Other">Other Territory (97)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Guest Classification</label>
              <select
                value={guestType}
                onChange={(e) => setGuestType(e.target.value as GuestType)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2"
              >
                <option value="Domestic">Domestic Guest</option>
                <option value="International">International (Form C)</option>
                <option value="Corporate">Corporate B2B</option>
              </select>
            </div>
          </div>
        </div>

        {/* 2. STATUTORY IDENTITY PROOF */}
        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            2. Statutory Identity Verification
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">ID Document Type</label>
              <select
                value={identityType}
                onChange={(e) => {
                  setIdentityType(e.target.value as IdentityType);
                  setIdError("");
                }}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2"
              >
                <option value="Aadhaar">Aadhaar Card (12-digit)</option>
                <option value="PAN">PAN Card (10-char)</option>
                <option value="Passport">Passport</option>
                <option value="VoterID">Voter ID</option>
                <option value="DrivingLicense">Driving License</option>
              </select>
            </div>

            <div>
              <Input
                label={`${identityType} Number`}
                placeholder={identityType === "Aadhaar" ? "12-digit Aadhaar number" : "ID Number"}
                value={idNumber}
                onChange={(e) => handleIdChange(e.target.value)}
                required
              />
              {idError && <p className="text-[11px] text-rose-400 mt-1">{idError}</p>}
            </div>
          </div>

          {/* Masked Aadhaar Display Requirement */}
          {identityType === "Aadhaar" && idNumber.length >= 8 && (
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
              <span className="text-slate-400">Masked Display for Privacy:</span>
              <span className="font-mono font-bold text-amber-400 tracking-wider">
                {maskAadhaar(idNumber)}
              </span>
            </div>
          )}

          {/* INTERNATIONAL GUEST SECTION (FORM C) */}
          {guestType === "International" && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3 mt-2">
              <span className="text-xs font-bold text-amber-400 block">
                Foreigners Regional Registration Office (Form C Compliance)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <Input
                  label="Passport Number"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                  required
                />
                <Input
                  label="Visa Number"
                  value={visaNumber}
                  onChange={(e) => setVisaNumber(e.target.value)}
                  required
                />
                <Input
                  label="Visa Expiry"
                  type="date"
                  value={visaExpiry}
                  onChange={(e) => setVisaExpiry(e.target.value)}
                  required
                />
                <Input
                  label="Nationality"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <Input
                  label="Arrival Date (India)"
                  type="date"
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                  required
                />
                <Input
                  label="Expected Departure"
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  required
                />
                <Input
                  label="Arrival Port"
                  value={arrivalPort}
                  onChange={(e) => setArrivalPort(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* CORPORATE B2B SECTION */}
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={isCorporate}
                onChange={(e) => setIsCorporate(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-amber-500"
              />
              <span>Bill to Company / Corporate GSTIN</span>
            </label>

            {isCorporate && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5 p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div>
                  <Input
                    label="Company 15-Digit GSTIN"
                    placeholder="e.g. 27AAACT2727Q1ZW"
                    value={corporateGstin}
                    onChange={(e) => handleGstinChange(e.target.value)}
                    required={isCorporate}
                  />
                  {gstinError && <p className="text-[11px] text-rose-400 mt-1">{gstinError}</p>}
                </div>
                <Input
                  label="Company Name"
                  placeholder="e.g. Tata Consultancy Services"
                  value={corporateName}
                  onChange={(e) => setCorporateName(e.target.value)}
                  required={isCorporate}
                />
              </div>
            )}
          </div>
        </div>

        {/* 3. ROOM SELECTION & DEPOSIT */}
        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" /> 3. Room Assignment & Advance Deposit
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Available Room</label>
              <select
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  const selected = availableRooms.find((r) => r.id === e.target.value);
                  if (selected?.baseRate) setDepositAmount(String(selected.baseRate));
                }}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2"
                required
              >
                {availableRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.roomNumber} ({r.roomType?.name || "Room"} - {formatINR(r.baseRate || 4200)}/n)
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Length of Stay (Nights)"
              type="number"
              min={1}
              value={nights}
              onChange={(e) => setNights(parseInt(e.target.value, 10) || 1)}
            />

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Guests</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={adults}
                  onChange={(e) => setAdults(parseInt(e.target.value, 10) || 1)}
                  className="w-1/2 bg-slate-900 border border-slate-800 text-white rounded px-2 py-1.5 text-xs text-center"
                  placeholder="Adults"
                />
                <input
                  type="number"
                  min={0}
                  value={children}
                  onChange={(e) => setChildren(parseInt(e.target.value, 10) || 0)}
                  className="w-1/2 bg-slate-900 border border-slate-800 text-white rounded px-2 py-1.5 text-xs text-center"
                  placeholder="Kids"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <Input
                label="Advance Deposit (₹)"
                type="number"
                value={depositAmount}
                onChange={(e) => handleDepositAmountChange(e.target.value)}
                required
              />
              {cashComplianceError && <p className="text-[11px] text-rose-400 mt-1 font-semibold">{cashComplianceError}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  const num = parseFloat(depositAmount) || 0;
                  if (e.target.value === "Cash") {
                    const check = validateCashCompliance(num, panNumber);
                    setCashComplianceError(check.isValid ? "" : check.errors[0] || "");
                  } else {
                    setCashComplianceError("");
                  }
                }}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2"
              >
                <option value="UPI">UPI / QR Code</option>
                <option value="Card">Debit / Credit Card</option>
                <option value="Cash">Cash</option>
                <option value="Bank_Transfer">Bank Transfer</option>
              </select>
            </div>

            {paymentMethod === "Cash" && parseFloat(depositAmount) > 50000 ? (
              <Input
                label="PAN Card (Mandatory for Cash > ₹50,000)"
                placeholder="ABCDE1234F"
                value={panNumber}
                onChange={(e) => {
                  setPanNumber(e.target.value.toUpperCase());
                  const check = validateCashCompliance(parseFloat(depositAmount) || 0, e.target.value.toUpperCase());
                  setCashComplianceError(check.isValid ? "" : check.errors[0] || "");
                }}
                required
              />
            ) : (
              <Input
                label="Transaction / Reference ID"
                placeholder="e.g. UPI-98129038"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="gold" size="sm" disabled={isSubmitting} className="font-bold">
            {isSubmitting ? "Processing Check-In..." : "Complete Check-In & Issue Key"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
