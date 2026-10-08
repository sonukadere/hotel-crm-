import { useState } from "react";
import {
  Button,
  Card,
  Input,
  Modal,
} from "@hotel/ui";
import { formatINR } from "@hotel/utils";
import type { CRMLead, GuestProfile, GuestBooking } from "../../services/crmApi";
import {
  searchGuestsApi,
  getGuestProfileApi,
  createCRMLeadApi,
  updateLeadStatusApi,
  getCRMLeadsApi,
} from "../../services/crmApi";
import {
  Search,
  User,
  Phone,
  Mail,
  MapPin,
  Building,
  Calendar,
  Users as UsersIcon,
  TrendingUp,
  Plus,
  Eye,
} from "lucide-react";

const LEAD_STATUS_OPTIONS: Array<CRMLead["status"]> = ["New", "Contacted", "Qualified", "Converted", "Lost"];

export function CRMDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GuestProfile[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestProfile | null>(null);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [isLoadingGuest, setIsLoadingGuest] = useState(false);

  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [newLead, setNewLead] = useState({
    guestName: "",
    mobile: "",
    email: "",
    source: "Website",
    requirement: "",
    expectedCheckIn: "",
    expectedCheckOut: "",
    guestCount: 2,
    notes: "",
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await searchGuestsApi(searchQuery);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleViewGuest = async (guestId: string) => {
    setIsLoadingGuest(true);
    setIsGuestModalOpen(true);
    const profile = await getGuestProfileApi(guestId);
    setSelectedGuest(profile);
    setIsLoadingGuest(false);
  };

  const handleLoadLeads = async () => {
    setIsLoadingLeads(true);
    const data = await getCRMLeadsApi("hotel-1");
    setLeads(data);
    setIsLoadingLeads(false);
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const lead = await createCRMLeadApi({
      hotelId: "hotel-1",
      ...newLead,
      guestCount: Number(newLead.guestCount),
    });
    if (lead) {
      setLeads((prev) => [lead, ...prev]);
      setIsLeadModalOpen(false);
      setNewLead({
        guestName: "",
        mobile: "",
        email: "",
        source: "Website",
        requirement: "",
        expectedCheckIn: "",
        expectedCheckOut: "",
        guestCount: 2,
        notes: "",
      });
    }
  };

  const handleUpdateLeadStatus = async (leadId: string, status: CRMLead["status"]) => {
    const updated = await updateLeadStatusApi(leadId, status, "user-1");
    if (updated) {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-IN");
  };

  const totalSpend = (bookings: GuestBooking[]) =>
    bookings.reduce((sum, b) => sum + (Number(b.grandTotal) || 0), 0);

  return (
    <div className="space-y-6">
      <Card className="bg-slate-950/70 border-slate-800 p-6 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-amber-400" />
              Guest CRM & Management
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Search by Mobile, Name, Email, Booking ID, Guest ID
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleLoadLeads} disabled={isLoadingLeads}>
              {isLoadingLeads ? "Loading..." : "Load Leads"}
            </Button>
            <Button variant="gold" size="sm" onClick={() => setIsLeadModalOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Lead
            </Button>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by Mobile, Name, Email, Booking ID, or Guest ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <Button type="submit" variant="primary" disabled={isSearching}>
            <Search className="w-4 h-4 mr-1.5" />
            {isSearching ? "Searching..." : "Search"}
          </Button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Search Results ({searchResults.length})</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {searchResults.map((guest) => (
                <div
                  key={guest.id}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{guest.fullName}</h4>
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {guest.guestType}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {guest.mobile}
                      </span>
                      {guest.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {guest.email}
                        </span>
                      )}
                      {guest.state && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {guest.state}, {guest.country}
                        </span>
                      )}
                      {guest.corporateName && (
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {guest.corporateName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">Guest ID: {guest.id}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleViewGuest(guest.id)}>
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                    View Profile
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="bg-slate-950/70 border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              CRM Leads Pipeline
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Lead → Reservation → Booking → Stay Conversion
            </p>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            No leads loaded yet. Click "Load Leads" to fetch existing leads.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leads.map((lead) => (
              <div key={lead.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-500">{lead.id}</span>
                    <select
                      value={lead.status}
                      onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value as CRMLead["status"])}
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-950 border border-slate-700 text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {LEAD_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <h4 className="text-sm font-bold text-white">{lead.guestName}</h4>
                  <div className="space-y-1 text-xs text-slate-400">
                    <p className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {lead.mobile}
                    </p>
                    {lead.email && (
                      <p className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {lead.email}
                      </p>
                    )}
                    <p>Source: {lead.source}</p>
                    {lead.guestCount && (
                      <p className="flex items-center gap-1">
                        <UsersIcon className="w-3 h-3" />
                        {lead.guestCount} guests
                      </p>
                    )}
                    {lead.expectedCheckIn && (
                      <p className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(lead.expectedCheckIn)} - {formatDate(lead.expectedCheckOut)}
                      </p>
                    )}
                  </div>
                  {lead.requirement && (
                    <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 line-clamp-3">
                      {lead.requirement}
                    </p>
                  )}
                  {lead.notes && <p className="text-xs text-slate-500">Notes: {lead.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Lead Modal */}
      <Modal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        title="Add New Inquiry / Lead"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Guest Name</label>
              <Input
                required
                value={newLead.guestName}
                onChange={(e) => setNewLead({ ...newLead, guestName: e.target.value })}
                placeholder="Rajesh Kumar"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Mobile (10 digits)</label>
              <Input
                required
                value={newLead.mobile}
                onChange={(e) => setNewLead({ ...newLead, mobile: e.target.value })}
                placeholder="9876543210"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Email (Optional)</label>
              <Input
                type="email"
                value={newLead.email}
                onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                placeholder="guest@example.com"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Source</label>
              <Input
                value={newLead.source}
                onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                placeholder="Website / Phone / Walk-in"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">Requirement</label>
            <textarea
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
              rows={3}
              value={newLead.requirement}
              onChange={(e) => setNewLead({ ...newLead, requirement: e.target.value })}
              placeholder="e.g. 2 Deluxe Rooms with MAP for 3 nights"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsLeadModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gold">
              Create Lead
            </Button>
          </div>
        </form>
      </Modal>

      {/* Guest Profile Modal */}
      <Modal
        isOpen={isGuestModalOpen}
        onClose={() => setIsGuestModalOpen(false)}
        title={selectedGuest?.fullName || "Guest Profile"}
        maxWidth="lg"
      >
        {isLoadingGuest ? (
          <div className="py-8 text-center text-slate-400 text-sm">Loading guest history...</div>
        ) : selectedGuest ? (
          <div className="space-y-4">
            <div className="bg-slate-900 p-4 rounded-xl space-y-2 border border-slate-800">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-white">{selectedGuest.fullName}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {selectedGuest.guestType}
                </span>
              </div>
              <p className="text-xs text-slate-400">Mobile: {selectedGuest.mobile} • Email: {selectedGuest.email || "N/A"}</p>
              {selectedGuest.corporateName && (
                <p className="text-xs text-blue-400">Corporate: {selectedGuest.corporateName} (GSTIN: {selectedGuest.corporateGstin || "N/A"})</p>
              )}
            </div>

            {selectedGuest.bookings && selectedGuest.bookings.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-2">
                  Stay History ({selectedGuest.bookings.length} stays • Total Spend: {formatINR(totalSpend(selectedGuest.bookings))})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedGuest.bookings.map((b) => (
                    <div key={b.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex justify-between">
                      <div>
                        <span className="font-mono text-amber-400">{b.bookingNumber}</span>
                        <p className="text-slate-400 text-[11px]">{formatDate(b.checkInDate)} to {formatDate(b.checkOutDate)}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-white">{formatINR(Number(b.grandTotal) || 0)}</span>
                        <p className="text-emerald-400 text-[10px]">{b.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
