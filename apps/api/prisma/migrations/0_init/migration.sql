-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('Available', 'Clean', 'Dirty', 'Occupied', 'Blocked', 'Maintenance');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('Inquiry', 'Tentative', 'Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled', 'NoShow');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('Cash', 'UPI', 'Card', 'Razorpay', 'Bank_Transfer', 'Other');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('Pending', 'Authorized', 'Captured', 'Failed', 'Refunded', 'PartiallyRefunded');

-- CreateEnum
CREATE TYPE "MealPlan" AS ENUM ('EP', 'CP', 'MAP', 'AP');

-- CreateEnum
CREATE TYPE "IdentityType" AS ENUM ('Aadhaar', 'PAN', 'Passport', 'VoterID', 'DrivingLicense');

-- CreateEnum
CREATE TYPE "GuestType" AS ENUM ('Domestic', 'International', 'Corporate');

-- CreateEnum
CREATE TYPE "LoyaltyTier" AS ENUM ('Bronze', 'Silver', 'Gold');

-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('Earn', 'Redeem', 'Expire', 'Adjustment', 'Reversal');

-- CreateEnum
CREATE TYPE "FolioItemType" AS ENUM ('Room', 'Food', 'Restaurant', 'InRoomDining', 'Laundry', 'Spa', 'Housekeeping', 'Banquet', 'OtherService', 'Discount');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('New', 'Contacted', 'Qualified', 'Converted', 'Lost');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SuperAdmin', 'Admin', 'Manager', 'FrontDesk', 'Housekeeping', 'Accountant');

-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "checkInTime" TEXT NOT NULL DEFAULT '14:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '11:00',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "floorNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BedType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BedType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomType" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "baseAdults" INTEGER NOT NULL DEFAULT 2,
    "maxAdults" INTEGER NOT NULL DEFAULT 3,
    "maxChildren" INTEGER NOT NULL DEFAULT 2,
    "amenities" TEXT NOT NULL DEFAULT '[]',
    "images" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "bedTypeId" TEXT,
    "status" "RoomStatus" NOT NULL DEFAULT 'Available',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "baseRate" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatePlan" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mealPlan" "MealPlan" NOT NULL DEFAULT 'EP',
    "baseRate" DECIMAL(12,2) NOT NULL,
    "seasonalMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    "weekendMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.15,
    "extraAdultRate" DECIMAL(12,2) NOT NULL DEFAULT 800.00,
    "extraChildRate" DECIMAL(12,2) NOT NULL DEFAULT 400.00,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "stateCode" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "guestType" "GuestType" NOT NULL DEFAULT 'Domestic',
    "corporateGstin" TEXT,
    "corporateName" TEXT,
    "internationalDetails" TEXT,
    "notes" TEXT,
    "preferences" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestIdentity" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "identityType" "IdentityType" NOT NULL,
    "idNumber" TEXT NOT NULL,
    "maskedIdNumber" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "issuedCountry" TEXT NOT NULL DEFAULT 'India',
    "expiryDate" TIMESTAMP(3),
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "primaryGuestId" TEXT NOT NULL,
    "roomId" TEXT,
    "roomTypeId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "actualCheckIn" TIMESTAMP(3),
    "actualCheckOut" TIMESTAMP(3),
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "mealPlan" "MealPlan" NOT NULL DEFAULT 'EP',
    "status" "BookingStatus" NOT NULL DEFAULT 'Confirmed',
    "bookingSource" TEXT NOT NULL DEFAULT 'Direct',
    "specialRequests" TEXT,
    "totalNights" INTEGER NOT NULL DEFAULT 1,
    "roomCharges" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "extraCharges" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "balanceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingGuest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "inquiryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tentativeDate" TIMESTAMP(3),
    "confirmedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folio" (
    "id" TEXT NOT NULL,
    "folioNumber" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "totalDebit" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "totalCredit" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "balanceDue" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioItem" (
    "id" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "itemType" "FolioItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "sacCode" TEXT NOT NULL DEFAULT '996311',
    "gstRate" DECIMAL(5,4) NOT NULL,
    "gstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "voidReason" TEXT,
    "splitTarget" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "guestId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'Captured',
    "transactionRef" TEXT,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "panNumber" TEXT,
    "notes" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GSTTransaction" (
    "id" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "folioItemId" TEXT,
    "taxableAmount" DECIMAL(12,2) NOT NULL,
    "cgstRate" DECIMAL(5,4) NOT NULL DEFAULT 0.00,
    "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "sgstRate" DECIMAL(5,4) NOT NULL DEFAULT 0.00,
    "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "igstRate" DECIMAL(5,4) NOT NULL DEFAULT 0.00,
    "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "totalTax" DECIMAL(12,2) NOT NULL,
    "sacCode" TEXT NOT NULL,
    "placeOfSupply" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GSTTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sacCode" TEXT NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "gstRate" DECIMAL(5,4) NOT NULL DEFAULT 0.18,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CRMLead" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "guestId" TEXT,
    "guestName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "source" TEXT NOT NULL DEFAULT 'Website',
    "requirement" TEXT,
    "expectedCheckIn" TIMESTAMP(3),
    "expectedCheckOut" TIMESTAMP(3),
    "guestCount" INTEGER DEFAULT 2,
    "status" "LeadStatus" NOT NULL DEFAULT 'New',
    "notes" TEXT,
    "convertedBookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CRMLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "tier" "LoyaltyTier" NOT NULL DEFAULT 'Bronze',
    "availablePoints" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "redeemedPoints" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL,
    "loyaltyAccountId" TEXT NOT NULL,
    "type" "LoyaltyTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "referenceFolioId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'FrontDesk',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hotel_code_key" ON "Hotel"("code");

-- CreateIndex
CREATE INDEX "Hotel_gstin_idx" ON "Hotel"("gstin");

-- CreateIndex
CREATE INDEX "Hotel_stateCode_idx" ON "Hotel"("stateCode");

-- CreateIndex
CREATE INDEX "Floor_hotelId_idx" ON "Floor"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_hotelId_floorNumber_key" ON "Floor"("hotelId", "floorNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BedType_name_key" ON "BedType"("name");

-- CreateIndex
CREATE INDEX "RoomType_hotelId_idx" ON "RoomType"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_hotelId_code_key" ON "RoomType"("hotelId", "code");

-- CreateIndex
CREATE INDEX "Room_hotelId_status_idx" ON "Room"("hotelId", "status");

-- CreateIndex
CREATE INDEX "Room_floorId_idx" ON "Room"("floorId");

-- CreateIndex
CREATE INDEX "Room_roomTypeId_idx" ON "Room"("roomTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_hotelId_roomNumber_key" ON "Room"("hotelId", "roomNumber");

-- CreateIndex
CREATE INDEX "RatePlan_hotelId_idx" ON "RatePlan"("hotelId");

-- CreateIndex
CREATE INDEX "RatePlan_roomTypeId_idx" ON "RatePlan"("roomTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "RatePlan_hotelId_roomTypeId_code_key" ON "RatePlan"("hotelId", "roomTypeId", "code");

-- CreateIndex
CREATE INDEX "Guest_mobile_idx" ON "Guest"("mobile");

-- CreateIndex
CREATE INDEX "Guest_fullName_idx" ON "Guest"("fullName");

-- CreateIndex
CREATE INDEX "Guest_email_idx" ON "Guest"("email");

-- CreateIndex
CREATE INDEX "GuestIdentity_guestId_idx" ON "GuestIdentity"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestIdentity_guestId_identityType_idNumber_key" ON "GuestIdentity"("guestId", "identityType", "idNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingNumber_key" ON "Booking"("bookingNumber");

-- CreateIndex
CREATE INDEX "Booking_hotelId_status_idx" ON "Booking"("hotelId", "status");

-- CreateIndex
CREATE INDEX "Booking_checkInDate_checkOutDate_idx" ON "Booking"("checkInDate", "checkOutDate");

-- CreateIndex
CREATE INDEX "Booking_primaryGuestId_idx" ON "Booking"("primaryGuestId");

-- CreateIndex
CREATE INDEX "Booking_roomId_idx" ON "Booking"("roomId");

-- CreateIndex
CREATE INDEX "BookingGuest_bookingId_idx" ON "BookingGuest"("bookingId");

-- CreateIndex
CREATE INDEX "BookingGuest_guestId_idx" ON "BookingGuest"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingGuest_bookingId_guestId_key" ON "BookingGuest"("bookingId", "guestId");

-- CreateIndex
CREATE INDEX "Reservation_bookingId_idx" ON "Reservation"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Folio_folioNumber_key" ON "Folio"("folioNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Folio_bookingId_key" ON "Folio"("bookingId");

-- CreateIndex
CREATE INDEX "Folio_hotelId_idx" ON "Folio"("hotelId");

-- CreateIndex
CREATE INDEX "Folio_guestId_idx" ON "Folio"("guestId");

-- CreateIndex
CREATE INDEX "Folio_status_idx" ON "Folio"("status");

-- CreateIndex
CREATE INDEX "FolioItem_folioId_idx" ON "FolioItem"("folioId");

-- CreateIndex
CREATE INDEX "FolioItem_sacCode_idx" ON "FolioItem"("sacCode");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");

-- CreateIndex
CREATE INDEX "Payment_folioId_idx" ON "Payment"("folioId");

-- CreateIndex
CREATE INDEX "Payment_guestId_idx" ON "Payment"("guestId");

-- CreateIndex
CREATE INDEX "Payment_razorpayOrderId_idx" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "Payment"("method");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GSTTransaction_folioItemId_key" ON "GSTTransaction"("folioItemId");

-- CreateIndex
CREATE INDEX "GSTTransaction_folioId_idx" ON "GSTTransaction"("folioId");

-- CreateIndex
CREATE INDEX "GSTTransaction_sacCode_idx" ON "GSTTransaction"("sacCode");

-- CreateIndex
CREATE INDEX "GSTTransaction_placeOfSupply_idx" ON "GSTTransaction"("placeOfSupply");

-- CreateIndex
CREATE INDEX "Service_hotelId_idx" ON "Service"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_hotelId_code_key" ON "Service"("hotelId", "code");

-- CreateIndex
CREATE INDEX "CRMLead_hotelId_status_idx" ON "CRMLead"("hotelId", "status");

-- CreateIndex
CREATE INDEX "CRMLead_mobile_idx" ON "CRMLead"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_guestId_key" ON "LoyaltyAccount"("guestId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_loyaltyAccountId_idx" ON "LoyaltyTransaction"("loyaltyAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuditLog_hotelId_idx" ON "AuditLog"("hotelId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_bedTypeId_fkey" FOREIGN KEY ("bedTypeId") REFERENCES "BedType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestIdentity" ADD CONSTRAINT "GuestIdentity_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_primaryGuestId_fkey" FOREIGN KEY ("primaryGuestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingGuest" ADD CONSTRAINT "BookingGuest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingGuest" ADD CONSTRAINT "BookingGuest_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioItem" ADD CONSTRAINT "FolioItem_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GSTTransaction" ADD CONSTRAINT "GSTTransaction_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GSTTransaction" ADD CONSTRAINT "GSTTransaction_folioItemId_fkey" FOREIGN KEY ("folioItemId") REFERENCES "FolioItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CRMLead" ADD CONSTRAINT "CRMLead_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CRMLead" ADD CONSTRAINT "CRMLead_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

