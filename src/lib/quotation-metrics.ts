import type { Prisma, QuotationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  isQuoteOpen,
  normalizeQuoteStatus,
  type QuotationAnalytics,
  type QuotationListDto,
} from "@/lib/quotation-types";
import { toNumber } from "@/lib/utils";

export type QuotationFilters = {
  q?: string;
  status?: QuotationStatus;
  customerId?: string;
  userId?: string;
  expiring?: boolean;
};

export async function getQuotations(filters?: QuotationFilters): Promise<QuotationListDto[]> {
  const where: Prisma.QuotationWhereInput = {};

  if (filters?.status) where.status = filters.status;
  if (filters?.customerId) where.customerId = filters.customerId;
  if (filters?.userId) where.userId = filters.userId;

  if (filters?.expiring) {
    const in7 = new Date(Date.now() + 7 * 86400000);
    where.validUntil = { lte: in7, gte: new Date() };
    where.status = { in: ["SENT", "UNDER_REVIEW", "NEGOTIATION", "APPROVED", "ACCEPTED"] };
  }

  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { quoteNumber: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { company: { contains: q, mode: "insensitive" } } },
      { lead: { company: { contains: q, mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.quotation.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, company: true } },
      lead: { select: { id: true, company: true } },
      user: { select: { name: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const now = new Date();

  return rows.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    revisionNumber: q.revisionNumber,
    customerName: q.customer?.name ?? q.lead?.company ?? "—",
    customerId: q.customerId,
    leadId: q.leadId,
    salesperson: q.user?.name ?? "Unassigned",
    total: toNumber(q.total),
    currency: q.currency,
    status: q.status,
    validUntil: q.validUntil?.toISOString() ?? null,
    taxMode: q.taxMode,
    incoterms: q.incoterms,
    requiresApproval: q.requiresApproval,
    isExpired: Boolean(q.validUntil && q.validUntil < now && isQuoteOpen(q.status)),
    createdAt: q.createdAt.toISOString(),
  }));
}

export async function getQuotationAnalytics(): Promise<QuotationAnalytics> {
  const quotes = await prisma.quotation.findMany({
    select: {
      status: true,
      total: true,
      createdAt: true,
      sentAt: true,
      approvedAt: true,
      validUntil: true,
    },
  });

  const now = new Date();
  const in7 = new Date(Date.now() + 7 * 86400000);

  const converted = quotes.filter((q) => q.status === "CONVERTED");
  const lost = quotes.filter((q) => q.status === "REJECTED" || q.status === "EXPIRED");
  const open = quotes.filter((q) => isQuoteOpen(q.status));

  const statusMap = new Map<QuotationStatus, { count: number; value: number }>();
  for (const q of quotes) {
    const st = normalizeQuoteStatus(q.status);
    const cur = statusMap.get(st) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += toNumber(q.total);
    statusMap.set(st, cur);
  }

  const negotiationDays = quotes
    .filter((q) => q.sentAt && q.approvedAt)
    .map((q) => (new Date(q.approvedAt!).getTime() - new Date(q.sentAt!).getTime()) / 86400000);

  const forecastValue = open.reduce((s, q) => {
    const weight =
      q.status === "NEGOTIATION" ? 0.7 : q.status === "APPROVED" || q.status === "ACCEPTED" ? 0.9 : 0.4;
    return s + toNumber(q.total) * weight;
  }, 0);

  return {
    totalQuotes: quotes.length,
    openQuotes: open.length,
    conversionRate:
      quotes.length > 0 ? Math.round((converted.length / quotes.length) * 1000) / 10 : 0,
    lostQuotes: lost.length,
    avgNegotiationDays:
      negotiationDays.length > 0
        ? Math.round(negotiationDays.reduce((a, b) => a + b, 0) / negotiationDays.length)
        : 0,
    forecastValue: Math.round(forecastValue),
    byStatus: Array.from(statusMap.entries()).map(([status, v]) => ({ status, ...v })),
    expiringSoon: quotes.filter(
      (q) => q.validUntil && q.validUntil >= now && q.validUntil <= in7 && isQuoteOpen(q.status),
    ).length,
  };
}

export async function syncQuotationExpiry(): Promise<number> {
  const now = new Date();
  const result = await prisma.quotation.updateMany({
    where: {
      validUntil: { lt: now },
      status: { in: ["SENT", "UNDER_REVIEW", "NEGOTIATION", "DRAFT"] },
    },
    data: { status: "EXPIRED", expiredAt: now },
  });
  return result.count;
}

export async function notifyQuotationExpiryReminders(): Promise<void> {
  const now = new Date();
  const in7 = new Date(Date.now() + 7 * 86400000);

  const expiring = await prisma.quotation.findMany({
    where: {
      validUntil: { lte: in7, gte: now },
      status: { in: ["SENT", "UNDER_REVIEW", "NEGOTIATION", "APPROVED", "ACCEPTED"] },
      userId: { not: null },
    },
    select: { id: true, quoteNumber: true, userId: true, validUntil: true },
  });

  for (const quote of expiring) {
    if (!quote.userId || !quote.validUntil) continue;
    const ruleKey = `quote-expiry-${quote.id}`;
    await prisma.notification.upsert({
      where: { userId_ruleKey: { userId: quote.userId, ruleKey } },
      create: {
        userId: quote.userId,
        title: "Quotation expiring soon",
        message: `${quote.quoteNumber} expires on ${quote.validUntil.toLocaleDateString("en-IN")}`,
        link: `/quotations/${quote.id}`,
        category: "SALES",
        severity: "WARNING",
        ruleKey,
        entityType: "Quotation",
        entityId: quote.id,
        actions: [{ type: "VIEW_DETAILS", label: "View quote", href: `/quotations/${quote.id}` }],
      },
      update: {
        message: `${quote.quoteNumber} expires on ${quote.validUntil.toLocaleDateString("en-IN")}`,
        read: false,
        status: "OPEN",
      },
    });
  }
}
