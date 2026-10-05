# 🏨 Indian Hotel PMS & CRM (Property Management System + CRM)

A production-ready Indian Hospitality Enterprise System built with **Turborepo**, **Node.js/Express**, **Prisma ORM**, **React 18**, and **Next.js 14 App Router**.

---

## 🏗️ Monorepo Architecture

```text
hotel/
├── apps/
│   ├── api/          # Express + Prisma + Redis + JWT Backend
│   ├── crm/          # React 18 + Vite + Tailwind + TanStack Query PMS Desk
│   └── web/          # Next.js 14 App Router Public Booking Website
├── packages/
│   ├── types/        # Shared TypeScript domain types and DTOs
│   ├── utils/        # Indian GST engine, rates engine, formatters & masking
│   ├── ui/           # Luxury UI design system (Buttons, Badges, Modals, Cards)
│   └── config/       # Hospitality constants, SAC codes, state codes, slabs
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## 🇮🇳 Indian Compliance & Financial Engine

### 1. Indian GST Slabs & SAC Codes
- **SAC 996311 (Hotel Accommodation / Room Tariff)**:
  - Tariff $\le$ ₹7,500/night $\rightarrow$ **12% GST**
  - Tariff $>$ ₹7,500/night $\rightarrow$ **18% GST**
- **SAC 996331 (Restaurant & In-Room Dining)** $\rightarrow$ **5% GST**
- **SAC 999799 (Laundry & Housekeeping)** $\rightarrow$ **18% GST**
- **SAC 997212 (Banquet & Event Spaces)** $\rightarrow$ **18% GST**

### 2. Tax Distribution Logic
- **Intra-State Booking** (`hotelStateCode === guestStateCode`):
  $$\text{CGST} = \frac{\text{GST}}{2}, \quad \text{SGST} = \frac{\text{GST}}{2}, \quad \text{IGST} = 0$$
- **Inter-State Booking** (`hotelStateCode !== guestStateCode`):
  $$\text{CGST} = 0, \quad \text{SGST} = 0, \quad \text{IGST} = \text{GST}$$

### 3. Legal Cash & Privacy Compliance
- **Income Tax Section 269ST**: Absolute prohibition on cash acceptance $\ge$ ₹2,00,000.
- **Income Tax Section 139A / Rule 114B**: Mandatory PAN capture for cash transactions $>$ ₹50,000.
- **UIDAI Privacy Safeguard**: Aadhaar numbers masked (`XXXX-XXXX-1234`).
- **B2B GSTIN Validation**: 15-character format verification with state-code extraction.

---

## 🗄️ Database Models (Prisma ORM)

All 19 normalized entities with exact decimal-safe financial persistence:
1. `Hotel` (Code, GSTIN, State Code, Contact)
2. `Floor` (Floor numbering, hierarchy)
3. `BedType` (King, Queen, Twin, Single)
4. `RoomType` (Standard, Deluxe, Suite, Premium, Family)
5. `Room` (Status: Available, Clean, Dirty, Occupied, Blocked, Maintenance)
6. `RatePlan` (EP, CP, MAP, AP with seasonal & weekend multipliers)
7. `Guest` (Domestic, International, Corporate, preferences)
8. `GuestIdentity` (Aadhaar, PAN, Passport, Voter ID, Driving License)
9. `Booking` (Inquiry, Tentative, Confirmed, CheckedIn, CheckedOut, Cancelled, NoShow)
10. `BookingGuest` (Primary & companion guests)
11. `Reservation` (Inquiry dates and validity)
12. `Folio` (Open, Closed, Settled)
13. `FolioItem` (Room, Dining, Laundry, Spa, Banquet with SAC and GST)
14. `Payment` (Cash, UPI, Card, Razorpay, Bank Transfer)
15. `GSTTransaction` (Audit ledger of every tax transaction)
16. `Service` (Catalog of hotel services)
17. `CRMLead` (New, Contacted, Qualified, Converted, Lost)
18. `LoyaltyAccount` (Bronze, Silver, Gold tiers with spend-based accrual)
19. `LoyaltyTransaction` (Earn, Redeem, Expire, Adjustment)
20. `AuditLog` (Immutable security audit log)
21. `User` (Staff & admin roles)

---

## 🚀 Quickstart & Scripts

### 1. Install dependencies
```bash
pnpm install
```

### 2. Generate Prisma Client & Database
```bash
cd apps/api
pnpm prisma:generate
```

### 3. Run Unit Tests (GST & Rate Calculation Engine)
```bash
pnpm --filter @hotel/utils test
```

### 4. Run Development Servers
```bash
pnpm dev
```
- **API Server**: `http://localhost:4000`
- **CRM / Admin Front Desk**: `http://localhost:5173`
- **Public Booking Website**: `http://localhost:3000`
