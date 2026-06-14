import type { CustomerCreditRisk, CustomerSegment, CustomerStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  HIGH_VALUE_THRESHOLD,
  type CustomerAnalytics,
  type CustomerDetailDto,
  type CustomerLedgerEntry,
  type CustomerListDto,
} from "@/lib/customer-types";
import { toNumber } from "@/lib/utils";

export type CustomerFilters = {
  q?: string;
  segment?: CustomerSegment;
  status?: CustomerStatus;
  risk?: CustomerCreditRisk;
  highValue?: boolean;
  sort?: "name" | "ltv" | "outstanding" | "recent";
};

function computeCreditUtilization(outstanding: number, creditLimit: number | null): number {
  if (!creditLimit || creditLimit <= 0) return 0;
  return Math.min(100, Math.round((outstanding / creditLimit) * 1000) / 10);
}

function computeCreditRisk(outstanding: number, creditLimit: number | null, overdueCount: number): CustomerCreditRisk {
  if (overdueCount >= 3 || (creditLimit && outstanding > creditLimit * 1.1)) return "CRITICAL";
  if (overdueCount >= 1 || (creditLimit && outstanding > creditLimit * 0.9)) return "HIGH";
  if (creditLimit && outstanding > creditLimit * 0.6) return "MEDIUM";
  return "LOW";
}

async function getCustomerFinancials(customerIds: string[]) {
  if (customerIds.length === 0) return new Map<string, { ltv: number; outstanding: number; overdueCount: number; paidTotal: number }>();

  const invoices = await prisma.saleInvoice.findMany({
    where: { customerId: { in: customerIds } },
    select: {
      customerId: true,
      total: true,
      paymentStatus: true,
      dueDate: true,
      payments: { select: { amount: true } },
    },
  });

  const map = new Map<string, { ltv: number; outstanding: number; overdueCount: number; paidTotal: number }>();
  const now = new Date();

  for (const inv of invoices) {
    const cur = map.get(inv.customerId) ?? { ltv: 0, outstanding: 0, overdueCount: 0, paidTotal: 0 };
    const total = toNumber(inv.total);
    const paid = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
    cur.ltv += total;
    cur.paidTotal += paid;
    const balance = total - paid;
    if (balance > 0.01) {
      cur.outstanding += balance;
      const isOverdue =
        inv.paymentStatus === "OVERDUE" ||
        (inv.dueDate && inv.dueDate < now && inv.paymentStatus !== "PAID" && inv.paymentStatus !== "CANCELLED");
      if (isOverdue) cur.overdueCount += 1;
    }
    map.set(inv.customerId, cur);
  }

  return map;
}

export function serializeCustomerList(
  c: {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
    phone: string;
    gstin: string | null;
    segment: CustomerSegment;
    status: CustomerStatus;
    creditRisk: CustomerCreditRisk;
    country: string | null;
    portalEnabled: boolean;
    creditLimit: unknown;
    lastOrderAt: Date | null;
    _count: { invoices: number; salesOrders: number };
  },
  financials: { ltv: number; outstanding: number; overdueCount: number },
): CustomerListDto {
  const creditLimit = c.creditLimit != null ? toNumber(c.creditLimit) : null;
  const risk = computeCreditRisk(financials.outstanding, creditLimit, financials.overdueCount);

  return {
    id: c.id,
    name: c.name,
    company: c.company,
    email: c.email,
    phone: c.phone,
    gstin: c.gstin,
    segment: c.segment,
    status: c.status,
    creditRisk: risk,
    country: c.country,
    portalEnabled: c.portalEnabled,
    invoiceCount: c._count.invoices,
    orderCount: c._count.salesOrders,
    lifetimeValue: financials.ltv,
    outstanding: financials.outstanding,
    overdueCount: financials.overdueCount,
    isHighValue: financials.ltv >= HIGH_VALUE_THRESHOLD,
    lastOrderAt: c.lastOrderAt?.toISOString() ?? null,
    creditLimit,
    creditUtilization: computeCreditUtilization(financials.outstanding, creditLimit),
  };
}

export async function getCustomers(filters?: CustomerFilters): Promise<CustomerListDto[]> {
  const where: Prisma.CustomerWhereInput = {};

  if (filters?.segment) where.segment = filters.segment;
  if (filters?.status) where.status = filters.status;
  if (filters?.risk) where.creditRisk = filters.risk;

  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { gstin: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { distributorTerritory: { contains: q, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
    filters?.sort === "recent"
      ? [{ lastOrderAt: "desc" }, { name: "asc" }]
      : [{ name: "asc" }];

  const rows = await prisma.customer.findMany({
    where,
    include: { _count: { select: { invoices: true, salesOrders: true } } },
    orderBy,
  });

  const finMap = await getCustomerFinancials(rows.map((r) => r.id));
  let list = rows.map((c) =>
    serializeCustomerList(c, finMap.get(c.id) ?? { ltv: 0, outstanding: 0, overdueCount: 0, paidTotal: 0 }),
  );

  if (filters?.highValue) list = list.filter((c) => c.isHighValue);

  if (filters?.sort === "ltv") list.sort((a, b) => b.lifetimeValue - a.lifetimeValue);
  if (filters?.sort === "outstanding") list.sort((a, b) => b.outstanding - a.outstanding);

  return list;
}

export async function getCustomerById(id: string): Promise<CustomerDetailDto | null> {
  const c = await prisma.customer.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      addresses: { orderBy: [{ isDefault: "desc" }, { type: "asc" }] },
      _count: { select: { invoices: true, salesOrders: true } },
    },
  });
  if (!c) return null;

  const finMap = await getCustomerFinancials([id]);
  const fin = finMap.get(id) ?? { ltv: 0, outstanding: 0, overdueCount: 0, paidTotal: 0 };
  const base = serializeCustomerList(c, fin);

  return {
    ...base,
    city: c.city,
    state: c.state,
    pincode: c.pincode,
    address: c.address,
    notes: c.notes,
    portalEmail: c.portalEmail,
    packagingPreference: c.packagingPreference,
    exportRequirements: c.exportRequirements,
    moq: c.moq,
    distributorTerritory: c.distributorTerritory,
    seasonalNotes: c.seasonalNotes,
    createdAt: c.createdAt.toISOString(),
    contacts: c.contacts,
    addresses: c.addresses,
  };
}

export async function getCustomerLedger(customerId: string): Promise<CustomerLedgerEntry[]> {
  const [invoices, payments] = await Promise.all([
    prisma.saleInvoice.findMany({
      where: { customerId },
      orderBy: { invoiceDate: "asc" },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        total: true,
        paymentStatus: true,
        payments: { select: { id: true, amount: true, paidAt: true, method: true, reference: true } },
      },
    }),
    prisma.payment.findMany({
      where: { sale: { customerId } },
      orderBy: { paidAt: "asc" },
      select: { id: true, amount: true, paidAt: true, method: true, reference: true, saleId: true },
    }),
  ]);

  type Row = { date: Date; type: "INVOICE" | "PAYMENT"; reference: string; debit: number; credit: number; status?: string; id: string };
  const rows: Row[] = [];

  for (const inv of invoices) {
    rows.push({
      id: inv.id,
      date: inv.invoiceDate,
      type: "INVOICE",
      reference: inv.invoiceNumber,
      debit: toNumber(inv.total),
      credit: 0,
      status: inv.paymentStatus,
    });
    for (const p of inv.payments) {
      rows.push({
        id: p.id,
        date: p.paidAt,
        type: "PAYMENT",
        reference: p.reference ?? `Payment (${p.method ?? "—"})`,
        debit: 0,
        credit: toNumber(p.amount),
      });
    }
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = 0;
  return rows.map((r) => {
    balance += r.debit - r.credit;
    return {
      id: r.id,
      date: r.date.toISOString(),
      type: r.type,
      reference: r.reference,
      debit: r.debit,
      credit: r.credit,
      balance,
      status: r.status,
    };
  });
}

export async function getCustomerAnalytics(): Promise<CustomerAnalytics> {
  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, company: true, segment: true, status: true },
  });

  const finMap = await getCustomerFinancials(customers.map((c) => c.id));

  let totalOutstanding = 0;
  let overdueInvoices = 0;
  let totalLtv = 0;
  let highValueCount = 0;
  const invoiceCounts = await prisma.saleInvoice.groupBy({
    by: ["customerId"],
    _count: true,
  });
  const repeatMap = Object.fromEntries(invoiceCounts.map((r) => [r.customerId, r._count]));
  let repeatCustomers = 0;

  const segmentMap = new Map<string, { count: number; revenue: number }>();

  for (const c of customers) {
    const fin = finMap.get(c.id) ?? { ltv: 0, outstanding: 0, overdueCount: 0, paidTotal: 0 };
    totalOutstanding += fin.outstanding;
    overdueInvoices += fin.overdueCount;
    totalLtv += fin.ltv;
    if (fin.ltv >= HIGH_VALUE_THRESHOLD) highValueCount += 1;

    if ((repeatMap[c.id] ?? 0) >= 2) repeatCustomers += 1;

    const seg = segmentMap.get(c.segment) ?? { count: 0, revenue: 0 };
    seg.count += 1;
    seg.revenue += fin.ltv;
    segmentMap.set(c.segment, seg);
  }

  const topCustomers = customers
    .map((c) => ({
      id: c.id,
      name: c.name,
      company: c.company,
      ltv: finMap.get(c.id)?.ltv ?? 0,
    }))
    .sort((a, b) => b.ltv - a.ltv)
    .slice(0, 10);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentInvoices = await prisma.saleInvoice.findMany({
    where: { invoiceDate: { gte: sixMonthsAgo } },
    select: { invoiceDate: true, total: true },
  });

  const monthMap = new Map<string, { revenue: number; orders: number }>();
  for (const inv of recentInvoices) {
    const key = inv.invoiceDate.toISOString().slice(0, 7);
    const cur = monthMap.get(key) ?? { revenue: 0, orders: 0 };
    cur.revenue += toNumber(inv.total);
    cur.orders += 1;
    monthMap.set(key, cur);
  }

  const salesTrend = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  return {
    totalCustomers: customers.length,
    activeCustomers: customers.filter((c) => c.status === "ACTIVE").length,
    highValueCount,
    totalOutstanding,
    overdueInvoices,
    avgLifetimeValue: customers.length > 0 ? Math.round(totalLtv / customers.length) : 0,
    bySegment: Array.from(segmentMap.entries()).map(([segment, v]) => ({
      segment: segment as CustomerSegment,
      ...v,
    })),
    topCustomers,
    salesTrend,
    repeatRate: customers.length > 0 ? Math.round((repeatCustomers / customers.length) * 1000) / 10 : 0,
  };
}

export async function getCustomerPaymentHistory(customerId: string) {
  return prisma.payment.findMany({
    where: { sale: { customerId } },
    orderBy: { paidAt: "desc" },
    include: { sale: { select: { invoiceNumber: true } } },
    take: 20,
  });
}

export async function getCustomerOverdueInvoices(customerId: string) {
  const now = new Date();
  return prisma.saleInvoice.findMany({
    where: {
      customerId,
      OR: [
        { paymentStatus: "OVERDUE" },
        { paymentStatus: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: now } },
      ],
    },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      dueDate: true,
      paymentStatus: true,
      payments: { select: { amount: true } },
    },
  });
}
