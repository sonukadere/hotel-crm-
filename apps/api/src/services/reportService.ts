import { prisma } from "../db/prisma";

export async function getRevenueReport(startDate?: string, endDate?: string) {
  const where: any = {};
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const payments = await prisma.payment.findMany({
    where: { ...where, status: "Captured" },
    include: { folio: { include: { hotel: true } } },
    orderBy: { receivedAt: "desc" },
  });

  const totalsByMethod: Record<string, number> = {};
  let grandTotal = 0;

  for (const p of payments) {
    const amt = Number(p.amount);
    totalsByMethod[p.method] = (totalsByMethod[p.method] || 0) + amt;
    grandTotal += amt;
  }

  return {
    payments,
    totalsByMethod,
    grandTotal,
    count: payments.length,
  };
}

export async function getGSTReport(startDate?: string, endDate?: string) {
  const where: any = {};
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const transactions = await prisma.gSTTransaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  let totalTaxable = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  let totalTax = 0;

  const sacSummary: Record<string, { taxable: number; tax: number }> = {};

  for (const t of transactions) {
    const taxable = Number(t.taxableAmount);
    const cgst = Number(t.cgstAmount);
    const sgst = Number(t.sgstAmount);
    const igst = Number(t.igstAmount);
    const tax = Number(t.totalTax);

    totalTaxable += taxable;
    totalCGST += cgst;
    totalSGST += sgst;
    totalIGST += igst;
    totalTax += tax;

    if (!sacSummary[t.sacCode]) {
      sacSummary[t.sacCode] = { taxable: 0, tax: 0 };
    }
    sacSummary[t.sacCode]!.taxable += taxable;
    sacSummary[t.sacCode]!.tax += tax;
  }

  return {
    transactions,
    summary: {
      totalTaxable,
      totalCGST,
      totalSGST,
      totalIGST,
      totalTax,
      sacSummary,
    },
  };
}

export async function getOutstandingFolios() {
  return await prisma.folio.findMany({
    where: {
      status: { not: "Settled" },
      balanceDue: { gt: 0.01 },
    },
    include: {
      guest: true,
      booking: {
        include: { room: true },
      },
      payments: true,
    },
    orderBy: { balanceDue: "desc" },
  });
}
