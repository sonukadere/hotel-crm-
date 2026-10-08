import { prisma } from "../db/prisma";
import type { FolioItemType, PaymentMethod } from "@hotel/types";
import {
  calculateServiceGST,
  numberToIndianWords,
  validateCashCompliance,
  calculateCentralizedFolio,
  SAC_BY_ITEM_TYPE,
  roundCurrency,
} from "@hotel/utils";
import { recordAuditLog } from "./auditService";

export interface FolioServiceError extends Error {
  statusCode?: number;
  errors?: string[];
}

function createFolioError(message: string, errors: string[] = [message], status = 400): FolioServiceError {
  const err = new Error(message) as FolioServiceError;
  err.statusCode = status;
  err.errors = errors;
  return err;
}

export async function recalculateFolio(tx: any, folioId: string) {
  const [items, payments, folio] = await Promise.all([
    tx.folioItem.findMany({ where: { folioId, isVoided: false } }),
    tx.payment.findMany({ where: { folioId } }),
    tx.folio.findUnique({ where: { id: folioId }, select: { bookingId: true } }),
  ]);

  const summary = calculateCentralizedFolio(
    items.map((i: any) => ({
      ...i,
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
      gstRate: Number(i.gstRate),
      gstAmount: Number(i.gstAmount),
      postedAt: i.postedAt?.toISOString?.() ?? String(i.postedAt),
    })),
    payments.map((p: any) => ({
      ...p,
      amount: Number(p.amount),
      receivedAt: p.receivedAt?.toISOString?.() ?? String(p.receivedAt),
      createdAt: p.createdAt?.toISOString?.() ?? String(p.createdAt),
    })),
  );

  const updatedFolio = await tx.folio.update({
    where: { id: folioId },
    data: {
      totalDebit: summary.totalDebit as any,
      totalCredit: summary.totalCredit as any,
      balanceDue: summary.balanceDue as any,
      status: summary.isSettled ? "Settled" : "Open",
    },
  });

  if (folio?.bookingId) {
    await tx.booking.update({
      where: { id: folio.bookingId },
      data: {
        paidAmount: summary.totalCredit as any,
        balanceAmount: summary.balanceDue as any,
      },
    });
  }

  return { folio: updatedFolio, summary };
}

export async function getFolioById(folioId: string) {
  const folio = await prisma.folio.findUnique({
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

  if (!folio) return null;

  const summary = calculateCentralizedFolio(
    folio.items.map((i) => ({
      ...i,
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
      gstRate: Number(i.gstRate),
      gstAmount: Number(i.gstAmount),
      postedAt: i.postedAt.toISOString(),
      splitTarget: (i.splitTarget as "Corporate" | "Personal") || "Personal",
      voidReason: i.voidReason ?? undefined,
    })) as any,
    folio.payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      receivedAt: p.receivedAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
      transactionRef: p.transactionRef ?? undefined,
      panNumber: p.panNumber ?? undefined,
      notes: p.notes ?? undefined,
    })) as any,
  );

  return {
    ...folio,
    summary,
  };
}

export async function listFolios(params: {
  hotelId?: string;
  status?: string;
  search?: string;
  limit?: number;
} = {}) {
  const hotelId = params.hotelId || "hotel-1";
  const where: any = { hotelId };

  if (params.status && params.status !== "ALL") {
    where.status = params.status;
  }

  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { folioNumber: { contains: q, mode: "insensitive" } },
      { guest: { fullName: { contains: q, mode: "insensitive" } } },
      { guest: { mobile: { contains: q } } },
      { booking: { bookingNumber: { contains: q, mode: "insensitive" } } },
    ];
  }

  const folios = await prisma.folio.findMany({
    where,
    include: {
      guest: { select: { fullName: true, mobile: true, email: true, corporateName: true, corporateGstin: true } },
      booking: { select: { bookingNumber: true, checkInDate: true, checkOutDate: true, room: { select: { roomNumber: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: params.limit || 50,
  });

  return folios;
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

  if (params.quantity <= 0) {
    throw createFolioError("Quantity must be greater than zero");
  }
  if (params.unitPrice < 0) {
    throw createFolioError("Unit price cannot be negative");
  }

  const lineTotal = roundCurrency(params.quantity * params.unitPrice);

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

  const sacCode = SAC_BY_ITEM_TYPE[params.itemType] || gstCalc.sacCode;

  return await prisma.$transaction(async (tx) => {
    // 1. Create Folio Item
    const item = await tx.folioItem.create({
      data: {
        folioId: params.folioId,
        itemType: params.itemType as any,
        description: params.description.trim(),
        quantity: params.quantity,
        unitPrice: params.unitPrice as any,
        totalPrice: lineTotal as any,
        sacCode,
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
        sacCode,
        placeOfSupply: gstCalc.placeOfSupply,
      },
    });

    // 3. Recalculate Folio
    const { summary } = await recalculateFolio(tx, params.folioId);

    // 4. Audit Log
    await recordAuditLog(
      {
        hotelId: folio.hotelId,
        userId: params.userId,
        action: "FOLIO_ITEM_ADDED",
        entity: "FolioItem",
        entityId: item.id,
        newValue: {
          itemType: params.itemType,
          description: params.description,
          totalPrice: lineTotal,
          gstAmount: gstCalc.totalTax,
          grandTotal: gstCalc.grandTotal,
          splitTarget: params.splitTarget || "Personal",
        },
      },
      tx,
    );

    return { item, summary };
  });
}

export async function editFolioItem(params: {
  folioItemId: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  splitTarget?: "Corporate" | "Personal";
  userId?: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const item = await tx.folioItem.findUniqueOrThrow({
      where: { id: params.folioItemId },
      include: { folio: { include: { hotel: true, guest: true } } },
    });

    if (item.isVoided) {
      throw createFolioError("Cannot edit a voided folio item");
    }

    const quantity = params.quantity !== undefined ? params.quantity : item.quantity;
    const unitPrice = params.unitPrice !== undefined ? params.unitPrice : Number(item.unitPrice);
    const lineTotal = roundCurrency(quantity * unitPrice);

    const serviceTypeMap: Record<string, "food" | "laundry" | "banquet" | "spa" | "other"> = {
      Food: "food",
      Restaurant: "food",
      InRoomDining: "food",
      Laundry: "laundry",
      Housekeeping: "laundry",
      Spa: "spa",
      Banquet: "banquet",
      Room: "other",
      Discount: "other",
      OtherService: "other",
    };

    const gstCalc = calculateServiceGST({
      amount: lineTotal,
      serviceType: serviceTypeMap[item.itemType] || "other",
      hotelStateCode: item.folio.hotel.stateCode,
      guestStateCode: item.folio.guest.stateCode || item.folio.hotel.stateCode,
    });

    const sacCode = SAC_BY_ITEM_TYPE[item.itemType as FolioItemType] || gstCalc.sacCode;

    const oldValues = {
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      splitTarget: item.splitTarget,
    };

    const updatedItem = await tx.folioItem.update({
      where: { id: params.folioItemId },
      data: {
        description: params.description !== undefined ? params.description.trim() : item.description,
        quantity,
        unitPrice: unitPrice as any,
        totalPrice: lineTotal as any,
        sacCode,
        gstRate: gstCalc.gstRate as any,
        gstAmount: gstCalc.totalTax as any,
        splitTarget: params.splitTarget !== undefined ? params.splitTarget : item.splitTarget,
      },
    });

    await tx.gSTTransaction.updateMany({
      where: { folioItemId: params.folioItemId },
      data: {
        taxableAmount: gstCalc.taxableAmount as any,
        cgstRate: gstCalc.cgstRate as any,
        cgstAmount: gstCalc.cgstAmount as any,
        sgstRate: gstCalc.sgstRate as any,
        sgstAmount: gstCalc.sgstAmount as any,
        igstRate: gstCalc.igstRate as any,
        igstAmount: gstCalc.igstAmount as any,
        totalTax: gstCalc.totalTax as any,
        sacCode,
        placeOfSupply: gstCalc.placeOfSupply,
      },
    });

    const { summary } = await recalculateFolio(tx, item.folioId);

    // Statutory audit logging for correction
    await recordAuditLog(
      {
        hotelId: item.folio.hotelId,
        userId: params.userId,
        action: "FOLIO_ITEM_EDITED",
        entity: "FolioItem",
        entityId: params.folioItemId,
        previousValue: oldValues,
        newValue: {
          description: updatedItem.description,
          quantity: updatedItem.quantity,
          unitPrice: Number(updatedItem.unitPrice),
          totalPrice: Number(updatedItem.totalPrice),
          splitTarget: updatedItem.splitTarget,
        },
      },
      tx,
    );

    return { item: updatedItem, summary };
  });
}

export async function voidFolioItem(params: {
  folioItemId: string;
  reason: string;
  userId?: string;
}) {
  const reason = params.reason?.trim();
  if (!reason) {
    throw createFolioError("A reason is mandatory when voiding or removing a folio item");
  }

  return await prisma.$transaction(async (tx) => {
    const item = await tx.folioItem.findUniqueOrThrow({
      where: { id: params.folioItemId },
      include: { folio: true },
    });

    if (item.isVoided) {
      throw createFolioError("Folio item is already voided");
    }

    const updated = await tx.folioItem.update({
      where: { id: params.folioItemId },
      data: {
        isVoided: true,
        voidReason: reason,
      },
    });

    // Zero out GST transaction for voided item
    await tx.gSTTransaction.updateMany({
      where: { folioItemId: params.folioItemId },
      data: {
        taxableAmount: 0 as any,
        cgstAmount: 0 as any,
        sgstAmount: 0 as any,
        igstAmount: 0 as any,
        totalTax: 0 as any,
      },
    });

    const { summary } = await recalculateFolio(tx, item.folioId);

    await recordAuditLog(
      {
        hotelId: item.folio.hotelId,
        userId: params.userId,
        action: "FOLIO_ITEM_VOIDED",
        entity: "FolioItem",
        entityId: params.folioItemId,
        previousValue: {
          isVoided: false,
          totalPrice: Number(item.totalPrice),
          gstAmount: Number(item.gstAmount),
        },
        newValue: { isVoided: true, voidReason: reason },
      },
      tx,
    );

    return { item: updated, summary };
  });
}

export async function removeFolioItem(params: {
  folioItemId: string;
  reason: string;
  userId?: string;
}) {
  return voidFolioItem(params);
}

export async function applyFolioDiscount(params: {
  folioId: string;
  amount: number;
  reason: string;
  splitTarget?: "Corporate" | "Personal";
  userId?: string;
}) {
  if (params.amount <= 0) {
    throw createFolioError("Discount amount must be greater than zero");
  }
  const reason = params.reason?.trim() || "Manager Special Discount";

  return await prisma.$transaction(async (tx) => {
    const folio = await tx.folio.findUniqueOrThrow({
      where: { id: params.folioId },
      include: { hotel: true },
    });

    const item = await tx.folioItem.create({
      data: {
        folioId: params.folioId,
        itemType: "Discount",
        description: `Promotional Discount: ${reason}`,
        quantity: 1,
        unitPrice: -params.amount as any,
        totalPrice: -params.amount as any,
        sacCode: "996311",
        gstRate: 0 as any,
        gstAmount: 0 as any,
        splitTarget: params.splitTarget || "Personal",
      },
    });

    const { summary } = await recalculateFolio(tx, params.folioId);

    await recordAuditLog(
      {
        hotelId: folio.hotelId,
        userId: params.userId,
        action: "FOLIO_DISCOUNT_APPLIED",
        entity: "FolioItem",
        entityId: item.id,
        newValue: {
          amount: params.amount,
          reason,
          splitTarget: params.splitTarget || "Personal",
        },
      },
      tx,
    );

    return { item, summary };
  });
}

export async function recordFolioPayment(params: {
  folioId: string;
  amount: number;
  method: PaymentMethod;
  transactionRef?: string;
  panNumber?: string;
  notes?: string;
  isAdvance?: boolean;
  userId?: string;
}) {
  if (params.amount <= 0) {
    throw createFolioError("Payment amount must be greater than zero");
  }

  // Statutory cash compliance verification
  if (params.method === "Cash") {
    const compliance = validateCashCompliance(params.amount, params.panNumber);
    if (!compliance.isValid) {
      throw createFolioError(compliance.errors[0] || "Cash compliance violation", compliance.errors, 422);
    }
  }

  return await prisma.$transaction(async (tx) => {
    const folio = await tx.folio.findUniqueOrThrow({
      where: { id: params.folioId },
      include: { hotel: true, guest: true },
    });

    // Generate sequential payment number
    const count = await tx.payment.count({ where: { folioId: params.folioId } });
    const paymentNumber = `PAY-${folio.hotel.code || "H"}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const noteText = params.isAdvance
      ? `Advance deposit: ${params.notes || "Collected at Front Desk"}`
      : params.notes || `Settlement via ${params.method}`;

    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        folioId: params.folioId,
        guestId: folio.guestId,
        amount: params.amount as any,
        method: params.method as any,
        status: "Captured",
        transactionRef: params.transactionRef || undefined,
        panNumber: params.panNumber ? params.panNumber.toUpperCase() : undefined,
        notes: noteText,
        receivedAt: new Date(),
      },
    });

    const { summary } = await recalculateFolio(tx, params.folioId);

    await recordAuditLog(
      {
        hotelId: folio.hotelId,
        userId: params.userId,
        action: "PAYMENT_CAPTURED",
        entity: "Payment",
        entityId: payment.id,
        newValue: {
          amount: params.amount,
          method: params.method,
          paymentNumber,
          isAdvance: params.isAdvance,
        },
      },
      tx,
    );

    return { payment, summary };
  });
}

export async function refundFolioPayment(params: {
  paymentId: string;
  amount?: number;
  reason: string;
  userId?: string;
}) {
  const reason = params.reason?.trim();
  if (!reason) {
    throw createFolioError("A reason is mandatory for any refund processing");
  }

  return await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: params.paymentId },
      include: { folio: { include: { hotel: true } } },
    });

    if (payment.status !== "Captured") {
      throw createFolioError(`Cannot refund payment with status ${payment.status}`);
    }

    const originalAmount = Number(payment.amount);
    const refundAmount = params.amount && params.amount > 0 ? Math.min(params.amount, originalAmount) : originalAmount;
    const isPartial = refundAmount < originalAmount;

    const updatedPayment = await tx.payment.update({
      where: { id: params.paymentId },
      data: {
        status: isPartial ? "PartiallyRefunded" : "Refunded",
        refundedAmount: refundAmount as any,
        notes: `${payment.notes || ""} [Refund of ₹${refundAmount.toLocaleString("en-IN")}: ${reason}]`,
      },
    });

    const { summary } = await recalculateFolio(tx, payment.folioId);

    await recordAuditLog(
      {
        hotelId: payment.folio.hotelId,
        userId: params.userId,
        action: "PAYMENT_REFUNDED",
        entity: "Payment",
        entityId: payment.id,
        previousValue: { amount: originalAmount, status: payment.status },
        newValue: {
          refundAmount,
          status: updatedPayment.status,
          reason,
        },
      },
      tx,
    );

    return { payment: updatedPayment, refundAmount, summary };
  });
}

export async function generateInvoiceData(
  folioId: string,
  options: {
    invoiceType?: "Consolidated" | "Corporate" | "Personal";
    userId?: string;
  } = {},
) {
  const folio = await getFolioById(folioId);
  if (!folio) throw createFolioError("Folio not found", ["Folio not found"], 404);

  const invoiceType = options.invoiceType || "Consolidated";

  // Filter items based on split billing choice
  let activeItems = folio.items.filter((i) => !i.isVoided);
  if (invoiceType === "Corporate") {
    activeItems = activeItems.filter((i) => i.splitTarget === "Corporate");
  } else if (invoiceType === "Personal") {
    activeItems = activeItems.filter((i) => i.splitTarget !== "Corporate");
  }

  const taxableAmount = roundCurrency(activeItems.reduce((acc, it) => acc + Number(it.totalPrice), 0));
  const totalTax = roundCurrency(activeItems.reduce((acc, it) => acc + Number(it.gstAmount), 0));
  const grandTotal = roundCurrency(taxableAmount + totalTax);

  // Group GST by SAC code
  const sacBreakdownMap: Record<
    string,
    {
      sacCode: string;
      description: string;
      taxableAmount: number;
      gstRate: number;
      cgstAmount: number;
      sgstAmount: number;
      igstAmount: number;
      totalTax: number;
    }
  > = {};

  const isInterState =
    Boolean(folio.guest.stateCode) &&
    folio.guest.stateCode !== folio.hotel.stateCode;

  for (const it of activeItems) {
    const sac = it.sacCode || "996311";
    const rate = Number(it.gstRate) || 0;
    const tax = Number(it.gstAmount) || 0;

    if (!sacBreakdownMap[sac]) {
      sacBreakdownMap[sac] = {
        sacCode: sac,
        description: it.description,
        taxableAmount: 0,
        gstRate: rate,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTax: 0,
      };
    }
    sacBreakdownMap[sac].taxableAmount = roundCurrency(sacBreakdownMap[sac].taxableAmount + Number(it.totalPrice));
    sacBreakdownMap[sac].totalTax = roundCurrency(sacBreakdownMap[sac].totalTax + tax);

    if (isInterState) {
      sacBreakdownMap[sac].igstAmount = roundCurrency(sacBreakdownMap[sac].igstAmount + tax);
    } else {
      sacBreakdownMap[sac].cgstAmount = roundCurrency(sacBreakdownMap[sac].cgstAmount + tax / 2);
      sacBreakdownMap[sac].sgstAmount = roundCurrency(sacBreakdownMap[sac].sgstAmount + tax / 2);
    }
  }

  const sacBreakdown = Object.values(sacBreakdownMap);
  const totalCgst = sacBreakdown.reduce((s, b) => s + b.cgstAmount, 0);
  const totalSgst = sacBreakdown.reduce((s, b) => s + b.sgstAmount, 0);
  const totalIgst = sacBreakdown.reduce((s, b) => s + b.igstAmount, 0);

  const prefix = invoiceType === "Corporate" ? "CORP" : invoiceType === "Personal" ? "PERS" : "TAX";
  const invoiceNumber = `INV-${folio.hotel.code || "HTL"}-${new Date().getFullYear()}-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

  const invoiceData = {
    invoiceNumber,
    invoiceDate: new Date().toISOString(),
    invoiceType,
    hotel: {
      name: folio.hotel.name,
      legalName: (folio.hotel as any).legalName || folio.hotel.name,
      address: folio.hotel.address,
      city: folio.hotel.city,
      state: folio.hotel.state,
      stateCode: folio.hotel.stateCode,
      pincode: folio.hotel.pincode,
      phone: folio.hotel.phone,
      email: folio.hotel.email,
      gstin: folio.hotel.gstin,
      pan: (folio.hotel as any).pan || (folio.hotel.gstin ? folio.hotel.gstin.slice(2, 12) : ""),
    },
    guest: {
      fullName: folio.guest.fullName,
      mobile: folio.guest.mobile,
      email: folio.guest.email,
      address: folio.guest.address,
      city: folio.guest.city,
      state: folio.guest.state,
      stateCode: folio.guest.stateCode,
      corporateName: folio.guest.corporateName,
      corporateGstin: folio.guest.corporateGstin,
    },
    booking: folio.booking ? {
      bookingNumber: folio.booking.bookingNumber,
      checkInDate: folio.booking.checkInDate,
      checkOutDate: folio.booking.checkOutDate,
      roomNumber: folio.booking.room?.roomNumber,
      roomType: folio.booking.roomType?.name,
      totalNights: folio.booking.totalNights,
    } : null,
    placeOfSupply: `${folio.hotel.stateCode} (${folio.hotel.state})`,
    isInterState,
    items: activeItems.map((i) => ({
      id: i.id,
      itemType: i.itemType,
      description: i.description,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
      sacCode: i.sacCode,
      gstRate: Number(i.gstRate),
      gstAmount: Number(i.gstAmount),
      splitTarget: i.splitTarget,
    })),
    sacBreakdown,
    taxableAmount,
    cgstAmount: roundCurrency(totalCgst),
    sgstAmount: roundCurrency(totalSgst),
    igstAmount: roundCurrency(totalIgst),
    totalTax,
    grandTotal,
    amountInWords: numberToIndianWords(grandTotal),
    payments: folio.payments.map((p) => ({
      paymentNumber: p.paymentNumber,
      method: p.method,
      amount: Number(p.amount),
      status: p.status,
      receivedAt: p.receivedAt,
    })),
    totalCredit: folio.summary.totalCredit,
    balanceDue: invoiceType === "Corporate"
      ? folio.summary.corporate.balanceDue
      : invoiceType === "Personal"
      ? folio.summary.personal.balanceDue
      : folio.summary.balanceDue,
    isSettled: folio.summary.isSettled,
  };

  await recordAuditLog({
    hotelId: folio.hotelId,
    userId: options.userId,
    action: "GST_INVOICE_GENERATED",
    entity: "Folio",
    entityId: folioId,
    newValue: {
      invoiceNumber,
      invoiceType,
      grandTotal,
      gstin: folio.guest.corporateGstin || folio.hotel.gstin,
    },
  });

  return invoiceData;
}
