import type { InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  deriveInvoiceStatus,
  syncLegacyPaymentStatus,
  type InvoiceAnalytics,
  type InvoiceListDto,
} from "@/lib/invoice-types";
import { toNumber } from "@/lib/utils";

export type InvoiceFilters = {
  q?: string;
  status?: InvoiceStatus;
  customerId?: string;
  overdue?: boolean;
  warehouseId?: string;
};

export async function getInvoices(filters?: InvoiceFilters): Promise<InvoiceListDto[]> {
  const where: Prisma.SaleInvoiceWhereInput = {};

  if (filters?.status) where.status = filters.status;
  if (filters?.customerId) where.customerId = filters.customerId;
  if (filters?.warehouseId) where.warehouseId = filters.warehouseId;

  if (filters?.overdue) {
    where.dueDate = { lt: new Date() };
    where.status = { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] };
  }

  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { eInvoiceIrn: { contains: q, mode: "insensitive" } },
      { eWayBillNumber: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { company: { contains: q, mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.saleInvoice.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, company: true } },
      user: { select: { name: true } },
      warehouse: { select: { name: true } },
      salesOrder: { select: { orderNumber: true } },
      _count: { select: { items: true } },
    },
    orderBy: [{ invoiceDate: "desc" }],
    take: 200,
  });

  const now = new Date();

  return rows.map((inv) => {
    const total = toNumber(inv.total);
    const paid = toNumber(inv.paidAmount);
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customer.name,
      customerId: inv.customerId,
      salesperson: inv.user?.name ?? "—",
      total,
      paidAmount: paid,
      balance: Math.max(0, total - paid),
      currency: inv.currency,
      status: inv.status,
      paymentStatus: inv.paymentStatus,
      taxMode: inv.taxMode,
      invoiceDate: inv.invoiceDate.toISOString(),
      dueDate: inv.dueDate?.toISOString() ?? null,
      isOverdue: Boolean(
        inv.dueDate && inv.dueDate < now && !["PAID", "CANCELLED", "REFUNDED", "DRAFT"].includes(inv.status),
      ),
      itemCount: inv._count.items,
      salesOrderNumber: inv.salesOrder?.orderNumber ?? null,
      warehouseName: inv.warehouse?.name ?? null,
      eInvoiceIrn: inv.eInvoiceIrn,
    };
  });
}

export async function getInvoiceAnalytics(): Promise<InvoiceAnalytics> {
  const invoices = await prisma.saleInvoice.findMany({
    include: {
      items: { include: { product: { select: { costPrice: true } } } },
      payments: { select: { amount: true, paidAt: true } },
    },
  });

  const now = new Date();
  let totalRevenue = 0;
  let collected = 0;
  let outstanding = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let marginSum = 0;
  let marginCount = 0;
  const statusMap = new Map<InvoiceStatus, { count: number; value: number }>();
  const agingBuckets = [
    { bucket: "0–30 days", min: 0, max: 30, count: 0, amount: 0 },
    { bucket: "31–60 days", min: 31, max: 60, count: 0, amount: 0 },
    { bucket: "61–90 days", min: 61, max: 90, count: 0, amount: 0 },
    { bucket: "90+ days", min: 91, max: 9999, count: 0, amount: 0 },
  ];
  const hsnMap = new Map<string, { taxableValue: number; gst: number }>();
  const payDays: number[] = [];

  for (const inv of invoices) {
    if (inv.status === "CANCELLED" || inv.status === "DRAFT") continue;
    const total = toNumber(inv.total);
    const paid = toNumber(inv.paidAmount);
    const balance = Math.max(0, total - paid);

    totalRevenue += total;
    collected += paid;
    outstanding += balance;

    const st = statusMap.get(inv.status) ?? { count: 0, value: 0 };
    st.count += 1;
    st.value += total;
    statusMap.set(inv.status, st);

    if (inv.status === "OVERDUE" || (inv.dueDate && inv.dueDate < now && balance > 0)) {
      overdueCount += 1;
      overdueAmount += balance;
      if (inv.dueDate) {
        const days = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000);
        for (const b of agingBuckets) {
          if (days >= b.min && days <= b.max) {
            b.count += 1;
            b.amount += balance;
            break;
          }
        }
        if (days > 90) {
          agingBuckets[3]!.count += 1;
          agingBuckets[3]!.amount += balance;
        }
      }
    }

    let rev = 0;
    let cost = 0;
    for (const item of inv.items) {
      const sub = toNumber(item.unitPrice) * toNumber(item.quantity) - toNumber(item.discountAmount);
      rev += sub;
      cost += toNumber(item.product.costPrice) * toNumber(item.quantity);
      const hsn = item.hsnCode ?? "—";
      const cur = hsnMap.get(hsn) ?? { taxableValue: 0, gst: 0 };
      cur.taxableValue += sub;
      cur.gst += toNumber(item.gstAmount);
      hsnMap.set(hsn, cur);
    }
    if (rev > 0) {
      marginSum += ((rev - cost) / rev) * 100;
      marginCount += 1;
    }

    if (inv.status === "PAID" && inv.paidAt && inv.invoiceDate) {
      payDays.push(Math.max(0, Math.floor((inv.paidAt.getTime() - inv.invoiceDate.getTime()) / 86400000)));
    }
  }

  const openInvoices = invoices.filter(
    (i) => !["PAID", "CANCELLED", "REFUNDED", "DRAFT"].includes(i.status),
  );
  const forecastReceivables = openInvoices.reduce((s, i) => {
    const weight =
      i.status === "VIEWED" ? 0.85 : i.status === "SENT" ? 0.7 : i.status === "PARTIALLY_PAID" ? 0.9 : 0.5;
    return s + Math.max(0, toNumber(i.total) - toNumber(i.paidAmount)) * weight;
  }, 0);

  return {
    totalInvoices: invoices.length,
    totalRevenue: Math.round(totalRevenue),
    collected: Math.round(collected),
    outstanding: Math.round(outstanding),
    overdueCount,
    overdueAmount: Math.round(overdueAmount),
    collectionRate: totalRevenue > 0 ? Math.round((collected / totalRevenue) * 1000) / 10 : 0,
    avgDaysToPay: payDays.length > 0 ? Math.round(payDays.reduce((a, b) => a + b, 0) / payDays.length) : 0,
    forecastReceivables: Math.round(forecastReceivables),
    marginEstimate: marginCount > 0 ? Math.round((marginSum / marginCount) * 10) / 10 : 0,
    byStatus: Array.from(statusMap.entries()).map(([status, v]) => ({ status, ...v })),
    aging: agingBuckets.map(({ bucket, count, amount }) => ({ bucket, count, amount: Math.round(amount) })),
    hsnSummary: Array.from(hsnMap.entries())
      .map(([hsn, v]) => ({ hsn, taxableValue: Math.round(v.taxableValue), gst: Math.round(v.gst) }))
      .sort((a, b) => b.taxableValue - a.taxableValue)
      .slice(0, 12),
  };
}

/** One-time alignment: map legacy paymentStatus → InvoiceStatus after schema upgrade */
export async function syncLegacyInvoiceStatusField(): Promise<void> {
  const map: Record<PaymentStatus, InvoiceStatus> = {
    PENDING: "SENT",
    PARTIAL: "PARTIALLY_PAID",
    PAID: "PAID",
    OVERDUE: "OVERDUE",
    CANCELLED: "CANCELLED",
  };

  for (const [paymentStatus, status] of Object.entries(map) as [PaymentStatus, InvoiceStatus][]) {
    await prisma.saleInvoice.updateMany({
      where: { paymentStatus, status: "DRAFT" },
      data: { status },
    });
  }
}

export async function syncInvoiceOverdue(): Promise<number> {
  const now = new Date();
  const candidates = await prisma.saleInvoice.findMany({
    where: {
      dueDate: { lt: now },
      status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID"] },
    },
    select: { id: true, total: true, paidAmount: true },
  });

  const ids = candidates
    .filter((i) => toNumber(i.total) - toNumber(i.paidAmount) > 0.01)
    .map((i) => i.id);

  if (ids.length === 0) return 0;

  const result = await prisma.saleInvoice.updateMany({
    where: { id: { in: ids } },
    data: { status: "OVERDUE", paymentStatus: "OVERDUE" },
  });
  return result.count;
}

export async function notifyOverdueInvoices(): Promise<void> {
  const overdue = await prisma.saleInvoice.findMany({
    where: {
      status: "OVERDUE",
      userId: { not: null },
    },
    select: { id: true, invoiceNumber: true, userId: true, total: true, paidAmount: true },
    take: 50,
  });

  for (const inv of overdue) {
    if (!inv.userId) continue;
    const ruleKey = `invoice-overdue-${inv.id}`;
    const balance = toNumber(inv.total) - toNumber(inv.paidAmount);
    await prisma.notification.upsert({
      where: { userId_ruleKey: { userId: inv.userId, ruleKey } },
      create: {
        userId: inv.userId,
        title: "Invoice overdue",
        message: `${inv.invoiceNumber} — ₹${balance.toLocaleString("en-IN")} outstanding`,
        link: `/sales/${inv.id}`,
        category: "SALES",
        severity: "WARNING",
        ruleKey,
        entityType: "SaleInvoice",
        entityId: inv.id,
        actions: [{ type: "VIEW_DETAILS", label: "View invoice", href: `/sales/${inv.id}` }],
      },
      update: { read: false, status: "OPEN" },
    });
  }
}

export async function recalculateInvoicePaymentState(invoiceId: string): Promise<void> {
  const inv = await prisma.saleInvoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payments: true },
  });
  const paidAmount = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
  const total = toNumber(inv.total);
  const status = deriveInvoiceStatus(total, paidAmount, inv.dueDate, inv.status);
  await prisma.saleInvoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount,
      status,
      paymentStatus: syncLegacyPaymentStatus(status),
      paidAt: status === "PAID" ? new Date() : inv.paidAt,
    },
  });
}
