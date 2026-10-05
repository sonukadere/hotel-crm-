import { prisma } from "../db/prisma";
import { FolioItemType } from "@hotel/types";
import { calculateServiceGST, numberToIndianWords } from "@hotel/utils";
import { recordAuditLog } from "./auditService";

export async function getFolioById(folioId: string) {
  return await prisma.folio.findUnique({
    where: { id: folioId },
    include: {
      booking: {
        include: {
          room: true,
          roomType: true,
          ratePlan: true,
        },
      },
      guest: {
        include: { identities: true },
      },
      items: {
        orderBy: { postedAt: "desc" },
      },
      payments: {
        orderBy: { receivedAt: "desc" },
      },
      gstTransactions: true,
      hotel: true,
    },
  });
}

export async function addFolioItem(params: {
  folioId: string;
  itemType: FolioItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  customGstRate?: number;
  splitTarget?: "Corporate" | "Personal";
  userId?: string;
}) {
  const folio = await prisma.folio.findUniqueOrThrow({
    where: { id: params.folioId },
    include: { hotel: true, guest: true },
  });

  const lineTotal = params.quantity * params.unitPrice;

  // Calculate service GST based on category
  const serviceTypeMap: Record<string, "food" | "laundry" | "banquet" | "spa" | "other"> = {
    Food: "food",
    Restaurant: "food",
    InRoomDining: "food",
    Laundry: "laundry",
    Housekeeping: "laundry",
    Spa: "spa",
    Banquet: "banquet",
  };

  const gstCalc = calculateServiceGST({
    amount: lineTotal,
    serviceType: serviceTypeMap[params.itemType] || "other",
    hotelStateCode: folio.hotel.stateCode,
    guestStateCode: folio.guest.stateCode || folio.hotel.stateCode,
    customRate: params.customGstRate,
  });

  return await prisma.$transaction(async (tx) => {
    // 1. Create Folio Item
    const item = await tx.folioItem.create({
      data: {
        folioId: params.folioId,
        itemType: params.itemType as any,
        description: params.description,
        quantity: params.quantity,
        unitPrice: params.unitPrice as any,
        totalPrice: lineTotal as any,
        sacCode: gstCalc.sacCode,
        gstRate: gstCalc.gstRate as any,
        gstAmount: gstCalc.totalTax as any,
        splitTarget: params.splitTarget || "Personal",
      },
    });

    // 2. Create GST Transaction
    await tx.gSTTransaction.create({
      data: {
        folioId: params.folioId,
        folioItemId: item.id,
        taxableAmount: gstCalc.taxableAmount as any,
        cgstRate: gstCalc.cgstRate as any,
        cgstAmount: gstCalc.cgstAmount as any,
        sgstRate: gstCalc.sgstRate as any,
        sgstAmount: gstCalc.sgstAmount as any,
        igstRate: gstCalc.igstRate as any,
        igstAmount: gstCalc.igstAmount as any,
        totalTax: gstCalc.totalTax as any,
        sacCode: gstCalc.sacCode,
        placeOfSupply: gstCalc.placeOfSupply,
      },
    });

    // 3. Recalculate and update Folio Totals
    const currentItems = await tx.folioItem.findMany({
      where: { folioId: params.folioId, isVoided: false },
    });
    const currentPayments = await tx.payment.findMany({
      where: { folioId: params.folioId, status: "Captured" },
    });

    const totalDebit = currentItems.reduce(
      (sum, it) => sum + Number(it.totalPrice) + Number(it.gstAmount),
      0,
    );
    const totalCredit = currentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const balanceDue = totalDebit - totalCredit;

    await tx.folio.update({
      where: { id: params.folioId },
      data: {
        totalDebit: totalDebit as any,
        totalCredit: totalCredit as any,
        balanceDue: balanceDue as any,
      },
    });

    await recordAuditLog({
      hotelId: folio.hotelId,
      userId: params.userId,
      action: "FOLIO_ITEM_ADDED",
      entity: "FolioItem",
      entityId: item.id,
      newValue: { description: params.description, total: gstCalc.grandTotal },
    });

    return item;
  });
}

export async function voidFolioItem(params: {
  folioItemId: string;
  reason: string;
  userId?: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const item = await tx.folioItem.findUniqueOrThrow({
      where: { id: params.folioItemId },
      include: { folio: true },
    });

    if (item.isVoided) throw new Error("Folio item is already voided");

    // Mark as voided
    const updated = await tx.folioItem.update({
      where: { id: params.folioItemId },
      data: {
        isVoided: true,
        voidReason: params.reason,
      },
    });

    // Recalculate Folio
    const currentItems = await tx.folioItem.findMany({
      where: { folioId: item.folioId, isVoided: false },
    });
    const currentPayments = await tx.payment.findMany({
      where: { folioId: item.folioId, status: "Captured" },
    });

    const totalDebit = currentItems.reduce(
      (sum, it) => sum + Number(it.totalPrice) + Number(it.gstAmount),
      0,
    );
    const totalCredit = currentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const balanceDue = totalDebit - totalCredit;

    await tx.folio.update({
      where: { id: item.folioId },
      data: {
        totalDebit: totalDebit as any,
        totalCredit: totalCredit as any,
        balanceDue: balanceDue as any,
      },
    });

    await recordAuditLog({
      hotelId: item.folio.hotelId,
      userId: params.userId,
      action: "FOLIO_ITEM_VOIDED",
      entity: "FolioItem",
      entityId: params.folioItemId,
      previousValue: { isVoided: false },
      newValue: { isVoided: true, reason: params.reason },
    });

    return updated;
  });
}

export async function generateInvoiceData(folioId: string) {
  const folio = await getFolioById(folioId);
  if (!folio) throw new Error("Folio not found");

  const nonVoidedItems = folio.items.filter((i) => !i.isVoided);
  const taxableAmount = nonVoidedItems.reduce((acc, it) => acc + Number(it.totalPrice), 0);
  const totalTax = nonVoidedItems.reduce((acc, it) => acc + Number(it.gstAmount), 0);
  const grandTotal = taxableAmount + totalTax;

  const invoiceNumber = `INV-${folio.hotel.code}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    invoiceNumber,
    invoiceDate: new Date().toISOString(),
    hotel: folio.hotel,
    guest: folio.guest,
    booking: folio.booking,
    items: nonVoidedItems,
    payments: folio.payments,
    taxableAmount,
    totalTax,
    grandTotal,
    amountInWords: numberToIndianWords(grandTotal),
    balanceDue: Number(folio.balanceDue),
    isSettled: Number(folio.balanceDue) <= 0.01,
  };
}
