import { PrismaClient } from "@prisma/client";
import { DEFAULT_HOTEL_INFO } from "@hotel/config";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Indian Hotel PMS database...");

  // 1. Create Default Hotel
  const hotel = await prisma.hotel.upsert({
    where: { code: DEFAULT_HOTEL_INFO.code },
    update: {},
    create: {
      code: DEFAULT_HOTEL_INFO.code,
      name: DEFAULT_HOTEL_INFO.name,
      gstin: DEFAULT_HOTEL_INFO.gstin,
      stateCode: DEFAULT_HOTEL_INFO.stateCode,
      address: DEFAULT_HOTEL_INFO.address,
      city: DEFAULT_HOTEL_INFO.city,
      state: DEFAULT_HOTEL_INFO.state,
      pincode: DEFAULT_HOTEL_INFO.pincode,
      phone: DEFAULT_HOTEL_INFO.phone,
      email: DEFAULT_HOTEL_INFO.email,
      checkInTime: DEFAULT_HOTEL_INFO.checkInTime,
      checkOutTime: DEFAULT_HOTEL_INFO.checkOutTime,
    },
  });

  console.log(`✓ Hotel created: ${hotel.name} (${hotel.gstin})`);

  // 2. Create Bed Types
  const kingBed = await prisma.bedType.upsert({
    where: { name: "King" },
    update: {},
    create: { name: "King", capacity: 2 },
  });
  const queenBed = await prisma.bedType.upsert({
    where: { name: "Queen" },
    update: {},
    create: { name: "Queen", capacity: 2 },
  });
  const twinBed = await prisma.bedType.upsert({
    where: { name: "Twin" },
    update: {},
    create: { name: "Twin", capacity: 2 },
  });

  // 3. Create Floors
  const floor1 = await prisma.floor.upsert({
    where: { hotelId_floorNumber: { hotelId: hotel.id, floorNumber: 1 } },
    update: {},
    create: { hotelId: hotel.id, floorNumber: 1, name: "Ground & Heritage Floor" },
  });
  const floor2 = await prisma.floor.upsert({
    where: { hotelId_floorNumber: { hotelId: hotel.id, floorNumber: 2 } },
    update: {},
    create: { hotelId: hotel.id, floorNumber: 2, name: "Royal Deluxe Floor" },
  });
  const floor3 = await prisma.floor.upsert({
    where: { hotelId_floorNumber: { hotelId: hotel.id, floorNumber: 3 } },
    update: {},
    create: { hotelId: hotel.id, floorNumber: 3, name: "Executive Suite Wing" },
  });

  // 4. Create Room Types
  const standardType = await prisma.roomType.upsert({
    where: { hotelId_code: { hotelId: hotel.id, code: "STD" } },
    update: {},
    create: {
      hotelId: hotel.id,
      code: "STD",
      name: "Standard Heritage Room",
      basePrice: 4200.0,
      baseAdults: 2,
      maxAdults: 2,
      maxChildren: 1,
      amenities: JSON.stringify(["High Speed WiFi", "Air Conditioning", "Tea/Coffee Maker", "Smart TV"]),
      images: JSON.stringify(["https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80"]),
    },
  });

  const deluxeType = await prisma.roomType.upsert({
    where: { hotelId_code: { hotelId: hotel.id, code: "DLX" } },
    update: {},
    create: {
      hotelId: hotel.id,
      code: "DLX",
      name: "Deluxe Courtyard View",
      basePrice: 6500.0,
      baseAdults: 2,
      maxAdults: 3,
      maxChildren: 2,
      amenities: JSON.stringify(["Private Balcony", "King Size Bed", "High Speed WiFi", "Mini Bar", "Work Desk"]),
      images: JSON.stringify(["https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80"]),
    },
  });

  const suiteType = await prisma.roomType.upsert({
    where: { hotelId_code: { hotelId: hotel.id, code: "SUI" } },
    update: {},
    create: {
      hotelId: hotel.id,
      code: "SUI",
      name: "Maharaja Royal Suite",
      basePrice: 12500.0, // Above ₹7,500 threshold (qualifies for 18% GST)
      baseAdults: 2,
      maxAdults: 4,
      maxChildren: 2,
      amenities: JSON.stringify(["Living Room Lounge", "Jacuzzi", "Butler Service", "Complimentary Airport Transfer", "Lounge Access"]),
      images: JSON.stringify(["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80"]),
    },
  });

  // 5. Create Rate Plans
  await prisma.ratePlan.upsert({
    where: { hotelId_roomTypeId_code: { hotelId: hotel.id, roomTypeId: standardType.id, code: "STD-EP" } },
    update: {},
    create: {
      hotelId: hotel.id,
      roomTypeId: standardType.id,
      code: "STD-EP",
      name: "Standard European Plan (Room Only)",
      mealPlan: "EP",
      baseRate: 4200.0,
      seasonalMultiplier: 1.0,
      weekendMultiplier: 1.15,
      extraAdultRate: 800.0,
      extraChildRate: 400.0,
    },
  });

  await prisma.ratePlan.upsert({
    where: { hotelId_roomTypeId_code: { hotelId: hotel.id, roomTypeId: deluxeType.id, code: "DLX-CP" } },
    update: {},
    create: {
      hotelId: hotel.id,
      roomTypeId: deluxeType.id,
      code: "DLX-CP",
      name: "Deluxe Continental Plan (With Breakfast)",
      mealPlan: "CP",
      baseRate: 7200.0,
      seasonalMultiplier: 1.0,
      weekendMultiplier: 1.15,
      extraAdultRate: 1000.0,
      extraChildRate: 500.0,
    },
  });

  await prisma.ratePlan.upsert({
    where: { hotelId_roomTypeId_code: { hotelId: hotel.id, roomTypeId: suiteType.id, code: "SUI-MAP" } },
    update: {},
    create: {
      hotelId: hotel.id,
      roomTypeId: suiteType.id,
      code: "SUI-MAP",
      name: "Maharaja Royal Suite (Breakfast & Dinner)",
      mealPlan: "MAP",
      baseRate: 14500.0,
      seasonalMultiplier: 1.0,
      weekendMultiplier: 1.20,
      extraAdultRate: 1800.0,
      extraChildRate: 900.0,
    },
  });

  // 6. Create Rooms with Diverse Operational Statuses
  const roomDefinitions = [
    { number: "101", floorId: floor1.id, roomTypeId: standardType.id, bedTypeId: kingBed.id, status: "Available" as const },
    { number: "102", floorId: floor1.id, roomTypeId: standardType.id, bedTypeId: twinBed.id, status: "Clean" as const },
    { number: "103", floorId: floor1.id, roomTypeId: standardType.id, bedTypeId: queenBed.id, status: "Dirty" as const },
    { number: "104", floorId: floor1.id, roomTypeId: standardType.id, bedTypeId: kingBed.id, status: "Maintenance" as const },
    { number: "201", floorId: floor2.id, roomTypeId: deluxeType.id, bedTypeId: kingBed.id, status: "Available" as const },
    { number: "202", floorId: floor2.id, roomTypeId: deluxeType.id, bedTypeId: kingBed.id, status: "Occupied" as const },
    { number: "203", floorId: floor2.id, roomTypeId: deluxeType.id, bedTypeId: twinBed.id, status: "Clean" as const },
    { number: "204", floorId: floor2.id, roomTypeId: deluxeType.id, bedTypeId: kingBed.id, status: "Blocked" as const },
    { number: "301", floorId: floor3.id, roomTypeId: suiteType.id, bedTypeId: kingBed.id, status: "Available" as const },
    { number: "302", floorId: floor3.id, roomTypeId: suiteType.id, bedTypeId: kingBed.id, status: "Occupied" as const },
  ];

  for (const r of roomDefinitions) {
    await prisma.room.upsert({
      where: { hotelId_roomNumber: { hotelId: hotel.id, roomNumber: r.number } },
      update: { status: r.status },
      create: {
        hotelId: hotel.id,
        roomNumber: r.number,
        floorId: r.floorId,
        roomTypeId: r.roomTypeId,
        bedTypeId: r.bedTypeId,
        status: r.status,
      },
    });
  }

  // 7. Create Default Admin User
  await prisma.user.upsert({
    where: { email: "admin@grandrajwada.com" },
    update: {},
    create: {
      hotelId: hotel.id,
      name: "Front Desk Operations Manager",
      email: "admin@grandrajwada.com",
      password: "$argon2id$v=19$m=65536,t=3,p=4$dummyhashedpasswordforinit$sample",
      role: "SuperAdmin",
    },
  });

  console.log("✓ Successfully seeded floors, rooms, rate plans, and admin user.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
