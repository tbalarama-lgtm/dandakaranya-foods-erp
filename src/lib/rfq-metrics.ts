import type { Prisma, RFQStatus, TamarindGrade, VendorClassification } from "@prisma/client";
import { prisma } from "@/lib/db";
import { safeModelCount, safeModelFindMany, safeModelFindUnique, safeQuery } from "@/lib/prisma-safe";
import { toNumber } from "@/lib/utils";
import {
  RFQ_LIFECYCLE,
  SEASONAL_INSIGHTS,
  type RfqAnalytics,
  type RfqComparisonMatrixRow,
  type RfqDetailDto,
  type RfqListRow,
  type RfqNegotiationRow,
  type RfqSourcingKpis,
  type RfqTimelineEvent,
} from "@/lib/rfq-types";

export type RfqListFilters = {
  q?: string;
  status?: RFQStatus;
  sourcingType?: string;
  sort?: "date" | "quotes" | "lowest" | "status";
};

/** Enterprise composite score — price, delivery, quality, compliance, QC history, FPO bonus. */
export function scoreRfqQuote(input: {
  unitPrice: number;
  lowestPrice: number;
  deliveryDays: number | null;
  moisturePct: number | null;
  pulpYieldPct: number | null;
  acidityPct: number | null;
  qualityScore: number | null;
  deliveryScore: number | null;
  complianceScore: number | null;
  reliabilityScore: number | null;
  qcPassRate: number | null;
  pricingHistoryScore: number | null;
  moistureLimit?: number;
  pulpYieldMin?: number;
  acidityMin?: number;
  isFpoPartner?: boolean;
  specGrade?: TamarindGrade | null;
  quoteGrade?: TamarindGrade | null;
}): { compositeScore: number; complianceScore: number; recommendation: string } {
  const priceScore = input.lowestPrice > 0 ? Math.min(100, (input.lowestPrice / input.unitPrice) * 100) : 50;
  const deliveryScore = input.deliveryDays != null ? Math.max(0, 100 - input.deliveryDays * 2.5) : 70;
  const quality = input.qualityScore ?? 85;
  const delivery = input.deliveryScore ?? 88;
  const reliability = input.reliabilityScore ?? 82;
  const qc = input.qcPassRate ?? 88;
  const history = input.pricingHistoryScore ?? 80;
  const moisture = input.moisturePct != null
    ? Math.max(0, 100 - Math.abs(input.moisturePct - (input.moistureLimit ?? 12)) * 8)
    : 80;
  const pulp = input.pulpYieldPct != null && input.pulpYieldMin
    ? Math.min(100, (input.pulpYieldPct / input.pulpYieldMin) * 100)
    : 75;
  const acidity = input.acidityPct != null && input.acidityMin
    ? Math.min(100, (input.acidityPct / input.acidityMin) * 100)
    : 75;

  let gradeMatch = 85;
  if (input.specGrade && input.quoteGrade) {
    const order = ["REJECT", "GRADE_B", "GRADE_A", "PREMIUM"];
    gradeMatch = order.indexOf(input.quoteGrade) >= order.indexOf(input.specGrade) ? 95 : 55;
  }

  const compliance = Math.round(
    (moisture * 0.25 + pulp * 0.2 + acidity * 0.15 + gradeMatch * 0.25 + (input.complianceScore ?? 85) * 0.15),
  );

  let compositeScore = Math.round(
    priceScore * 0.28 +
      deliveryScore * 0.12 +
      quality * 0.18 +
      delivery * 0.1 +
      compliance * 0.15 +
      reliability * 0.07 +
      qc * 0.05 +
      history * 0.05,
  );

  if (input.isFpoPartner) compositeScore = Math.min(100, compositeScore + 3);

  let recommendation = "Competitive bid — review matrix";
  if (compositeScore >= 92) recommendation = "AI recommended — best overall sourcing value";
  else if (priceScore >= 98) recommendation = "Lowest price — strong commercial terms";
  else if (compliance >= 90) recommendation = "High compliance — food-spec aligned";
  else if (input.isFpoPartner && compositeScore >= 85) recommendation = "FPO partner — social impact & cost advantage";
  else if (compositeScore < 68) recommendation = "Below benchmark — negotiate or reject";

  return { compositeScore, complianceScore: compliance, recommendation };
}

async function vendorQcPassRate(vendorId: string): Promise<number> {
  const records = await safeQuery(
    () =>
      prisma.vendorQualityRecord.findMany({
        where: { vendorId },
        select: { passed: true },
        take: 20,
        orderBy: { recordedAt: "desc" },
      }),
    [],
  );
  if (!records.length) return 88;
  const passed = records.filter((r) => r.passed).length;
  return Math.round((passed / records.length) * 100);
}

async function vendorPricingHistoryScore(vendorId: string): Promise<number> {
  const purchases = await safeQuery(
    () =>
      prisma.purchase.findMany({
        where: { vendorId },
        select: { total: true },
        orderBy: { purchaseDate: "desc" },
        take: 6,
      }),
    [],
  );
  if (purchases.length < 2) return 78;
  const totals = purchases.map((p) => toNumber(p.total));
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  const latest = totals[0];
  if (latest <= avg * 0.95) return 92;
  if (latest <= avg) return 85;
  return 72;
}

export async function compareRfqQuotes(rfqId: string): Promise<RfqComparisonMatrixRow[]> {
  const rfq = await safeModelFindUnique<{
    specTamarindGrade: TamarindGrade | null;
    specMoistureMaxPct: Prisma.Decimal | null;
    specPulpYieldMinPct: Prisma.Decimal | null;
    specAcidityMin: Prisma.Decimal | null;
    aiRecommendedVendorId: string | null;
    quotes: {
      id: string;
      vendorId: string;
      unitPrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
      deliveryDays: number | null;
      moq: Prisma.Decimal | null;
      moisturePct: Prisma.Decimal | null;
      pulpYieldPct: Prisma.Decimal | null;
      acidityPct: Prisma.Decimal | null;
      tamarindGrade: TamarindGrade | null;
      qualityScore: Prisma.Decimal | null;
      complianceScore: Prisma.Decimal | null;
      reliabilityScore: Prisma.Decimal | null;
      counterOfferPrice: Prisma.Decimal | null;
      isSelected: boolean;
      vendor: {
        id: string;
        name: string;
        classification: VendorClassification;
        qualityScore: Prisma.Decimal | null;
        deliveryScore: Prisma.Decimal | null;
        moistureLimitPct: Prisma.Decimal | null;
        isFpoPartner: boolean;
      };
    }[];
  }>("procurementRFQ", {
    where: { id: rfqId },
    include: {
      quotes: {
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              classification: true,
              qualityScore: true,
              deliveryScore: true,
              moistureLimitPct: true,
              isFpoPartner: true,
            },
          },
        },
      },
    },
  });

  if (!rfq?.quotes.length) return [];

  const prices = rfq.quotes.map((q) => toNumber(q.unitPrice));
  const lowest = Math.min(...prices);
  const moistureLimit = rfq.quotes[0]?.vendor.moistureLimitPct != null
    ? toNumber(rfq.quotes[0].vendor.moistureLimitPct)
    : toNumber(rfq.specMoistureMaxPct) || 12;

  const scored = await Promise.all(
    rfq.quotes.map(async (q) => {
      const qcPassRate = await vendorQcPassRate(q.vendorId);
      const pricingHistoryScore = await vendorPricingHistoryScore(q.vendorId);
      const reliability =
        q.reliabilityScore != null
          ? toNumber(q.reliabilityScore)
          : Math.round((toNumber(q.vendor.deliveryScore) + qcPassRate) / 2);

      const { compositeScore, complianceScore, recommendation } = scoreRfqQuote({
        unitPrice: toNumber(q.unitPrice),
        lowestPrice: lowest,
        deliveryDays: q.deliveryDays,
        moisturePct: q.moisturePct != null ? toNumber(q.moisturePct) : null,
        pulpYieldPct: q.pulpYieldPct != null ? toNumber(q.pulpYieldPct) : null,
        acidityPct: q.acidityPct != null ? toNumber(q.acidityPct) : null,
        qualityScore: q.qualityScore != null ? toNumber(q.qualityScore) : toNumber(q.vendor.qualityScore),
        deliveryScore: toNumber(q.vendor.deliveryScore),
        complianceScore: q.complianceScore != null ? toNumber(q.complianceScore) : null,
        reliabilityScore: reliability,
        qcPassRate,
        pricingHistoryScore,
        moistureLimit,
        pulpYieldMin: rfq.specPulpYieldMinPct != null ? toNumber(rfq.specPulpYieldMinPct) : undefined,
        acidityMin: rfq.specAcidityMin != null ? toNumber(rfq.specAcidityMin) : undefined,
        isFpoPartner: q.vendor.isFpoPartner,
        specGrade: rfq.specTamarindGrade,
        quoteGrade: q.tamarindGrade,
      });

      return {
        quoteId: q.id,
        vendorId: q.vendor.id,
        vendorName: q.vendor.name,
        vendorClassification: q.vendor.classification,
        isFpoPartner: q.vendor.isFpoPartner,
        unitPrice: toNumber(q.unitPrice),
        totalPrice: toNumber(q.totalPrice),
        deliveryDays: q.deliveryDays,
        moq: q.moq != null ? toNumber(q.moq) : null,
        moisturePct: q.moisturePct != null ? toNumber(q.moisturePct) : null,
        pulpYieldPct: q.pulpYieldPct != null ? toNumber(q.pulpYieldPct) : null,
        acidityPct: q.acidityPct != null ? toNumber(q.acidityPct) : null,
        tamarindGrade: q.tamarindGrade,
        qualityScore: q.qualityScore != null ? toNumber(q.qualityScore) : toNumber(q.vendor.qualityScore) ?? 85,
        complianceScore,
        reliabilityScore: reliability,
        pricingHistoryScore,
        qcPassRate,
        compositeScore,
        rank: 0,
        isSelected: q.isSelected,
        isAiRecommended: rfq.aiRecommendedVendorId === q.vendorId,
        recommendation,
        counterOfferPrice: q.counterOfferPrice != null ? toNumber(q.counterOfferPrice) : null,
      } satisfies RfqComparisonMatrixRow;
    }),
  );

  return scored.sort((a, b) => b.compositeScore - a.compositeScore).map((s, i) => ({ ...s, rank: i + 1 }));
}

export async function getRfqSourcingKpis(): Promise<RfqSourcingKpis> {
  const rfqs = await safeModelFindMany<{
    status: RFQStatus;
    baselinePrice: Prisma.Decimal | null;
    quotes: { totalPrice: Prisma.Decimal; responseHours: number | null; quotedAt: Date }[];
    sentAt: Date | null;
    comparisonStartedAt: Date | null;
    awardedAt: Date | null;
    createdAt: Date;
  }>("procurementRFQ", {
    include: { quotes: { select: { totalPrice: true, responseHours: true, quotedAt: true } } },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const active = rfqs.filter((r) =>
    ["SENT", "QUOTED", "COMPARED", "APPROVED"].includes(r.status),
  ).length;

  let savingsSum = 0;
  let savingsCount = 0;
  let responseSum = 0;
  let responseCount = 0;
  let negDaysSum = 0;
  let negCount = 0;
  let awarded = 0;
  let converted = 0;

  for (const r of rfqs) {
    if (r.status === "AWARDED" || r.status === "CLOSED") converted += 1;
    if (r.awardedAt && r.awardedAt >= monthStart) awarded += 1;
    if (r.quotes.length) {
      const lowest = Math.min(...r.quotes.map((q) => toNumber(q.totalPrice)));
      if (r.baselinePrice && toNumber(r.baselinePrice) > 0) {
        savingsSum += ((toNumber(r.baselinePrice) - lowest) / toNumber(r.baselinePrice)) * 100;
        savingsCount += 1;
      }
      for (const q of r.quotes) {
        if (q.responseHours != null) {
          responseSum += q.responseHours;
          responseCount += 1;
        } else if (r.sentAt) {
          responseSum += Math.max(1, Math.round((q.quotedAt.getTime() - r.sentAt.getTime()) / 3600000));
          responseCount += 1;
        }
      }
    }
    if (r.sentAt && r.comparisonStartedAt) {
      negDaysSum += (r.comparisonStartedAt.getTime() - r.sentAt.getTime()) / 86400000;
      negCount += 1;
    }
  }

  return {
    totalRfqs: rfqs.length,
    activeRfqs: active,
    avgResponseHours: responseCount ? Math.round(responseSum / responseCount) : 0,
    avgNegotiationDays: negCount ? Math.round((negDaysSum / negCount) * 10) / 10 : 0,
    conversionRatePct: rfqs.length ? Math.round((converted / rfqs.length) * 100) : 0,
    procurementSavingsPct: savingsCount ? Math.round((savingsSum / savingsCount) * 10) / 10 : 0,
    awardedThisMonth: awarded,
    pendingComparison: rfqs.filter((r) => r.status === "QUOTED" || r.status === "SENT").length,
  };
}

export async function getRfqList(filters: RfqListFilters = {}): Promise<RfqListRow[]> {
  const rfqs = await safeModelFindMany<{
    id: string;
    rfqNumber: string;
    title: string;
    status: RFQStatus;
    productName: string | null;
    quantity: Prisma.Decimal | null;
    unit: string | null;
    dueDate: Date | null;
    createdAt: Date;
    sentAt: Date | null;
    sourcingType: RfqListRow["sourcingType"];
    auctionMode: RfqListRow["auctionMode"];
    budgetAmount: Prisma.Decimal | null;
    quotes: { totalPrice: Prisma.Decimal }[];
    awardedVendor: { name: string } | null;
  }>("procurementRFQ", {
    include: {
      quotes: { select: { totalPrice: true } },
      awardedVendor: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  let rows: RfqListRow[] = rfqs.map((r) => {
    const lowest = r.quotes.length ? Math.min(...r.quotes.map((q) => toNumber(q.totalPrice))) : null;
    const budget = r.budgetAmount != null ? toNumber(r.budgetAmount) : null;
    const budgetOverPct =
      budget && lowest && lowest > budget ? Math.round(((lowest - budget) / budget) * 1000) / 10 : null;

    return {
      id: r.id,
      rfqNumber: r.rfqNumber,
      title: r.title,
      status: r.status,
      productName: r.productName,
      quantity: r.quantity != null ? toNumber(r.quantity) : null,
      unit: r.unit,
      dueDate: r.dueDate?.toISOString() ?? null,
      quoteCount: r.quotes.length,
      lowestQuote: lowest,
      awardedVendorName: r.awardedVendor?.name ?? null,
      sourcingType: r.sourcingType,
      auctionMode: r.auctionMode,
      budgetAmount: budget,
      budgetOverPct,
      createdAt: r.createdAt.toISOString(),
      sentAt: r.sentAt?.toISOString() ?? null,
    };
  });

  if (filters.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.rfqNumber.toLowerCase().includes(q) ||
        (r.productName?.toLowerCase().includes(q) ?? false),
    );
  }
  if (filters.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters.sourcingType) rows = rows.filter((r) => r.sourcingType === filters.sourcingType);

  const sort = filters.sort ?? "date";
  rows.sort((a, b) => {
    if (sort === "quotes") return b.quoteCount - a.quoteCount;
    if (sort === "lowest") return (a.lowestQuote ?? 0) - (b.lowestQuote ?? 0);
    if (sort === "status") return RFQ_LIFECYCLE.indexOf(a.status) - RFQ_LIFECYCLE.indexOf(b.status);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return rows;
}

export async function getRfqDetail(id: string): Promise<RfqDetailDto | null> {
  const rfq = await safeModelFindUnique<{
    id: string;
    rfqNumber: string;
    title: string;
    status: RFQStatus;
    productName: string | null;
    quantity: Prisma.Decimal | null;
    unit: string | null;
    dueDate: Date | null;
    notes: string | null;
    budgetAmount: Prisma.Decimal | null;
    baselinePrice: Prisma.Decimal | null;
    specTamarindGrade: TamarindGrade | null;
    specMoistureMaxPct: Prisma.Decimal | null;
    specPulpYieldMinPct: Prisma.Decimal | null;
    specAcidityMin: Prisma.Decimal | null;
    packagingRequirements: string | null;
    moqRequired: Prisma.Decimal | null;
    sourcingType: RfqDetailDto["sourcingType"];
    auctionMode: RfqDetailDto["auctionMode"];
    auctionEndsAt: Date | null;
    negotiationDeadline: Date | null;
    seasonalWindow: string | null;
    awardedVendorId: string | null;
    aiRecommendedVendorId: string | null;
    sentAt: Date | null;
    comparisonStartedAt: Date | null;
    approvedAt: Date | null;
    awardedAt: Date | null;
    awardedVendor: { name: string } | null;
    aiRecommendedVendor: { name: string } | null;
    purchases: { id: string; purchaseNumber: string }[];
    events: {
      id: string;
      eventType: RfqTimelineEvent["eventType"];
      title: string;
      detail: string | null;
      createdAt: Date;
      vendor: { name: string } | null;
    }[];
    negotiations: {
      id: string;
      round: number;
      offeredBy: string;
      unitPrice: Prisma.Decimal;
      notes: string | null;
      createdAt: Date;
      quote: { vendor: { name: string } };
    }[];
  }>("procurementRFQ", {
    where: { id },
    include: {
      awardedVendor: { select: { name: true } },
      aiRecommendedVendor: { select: { name: true } },
      purchases: { select: { id: true, purchaseNumber: true }, take: 1 },
      events: { orderBy: { createdAt: "desc" }, include: { vendor: { select: { name: true } } } },
      negotiations: {
        orderBy: { createdAt: "desc" },
        include: { quote: { include: { vendor: { select: { name: true } } } } },
      },
    },
  });

  if (!rfq) return null;

  const matrix = await compareRfqQuotes(id);
  const top = matrix[0];
  const aiReason = top
    ? `${top.vendorName}: composite ${top.compositeScore}/100 — ${top.recommendation}`
    : null;

  if (top && !rfq.aiRecommendedVendorId) {
    await safeQuery(
      () =>
        prisma.procurementRFQ.update({
          where: { id },
          data: { aiRecommendedVendorId: top.vendorId },
        }),
      null,
    );
  }

  const fpoQuotes = matrix.filter((m) => m.isFpoPartner);
  const commercialQuotes = matrix.filter((m) => !m.isFpoPartner);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const fpoAvg = avg(fpoQuotes.map((q) => q.unitPrice));
  const commAvg = avg(commercialQuotes.map((q) => q.unitPrice));
  const fpoSavingsPct =
    fpoAvg && commAvg && commAvg > 0 ? Math.round(((commAvg - fpoAvg) / commAvg) * 1000) / 10 : null;

  const lowest = matrix.length ? Math.min(...matrix.map((m) => m.totalPrice)) : null;
  const budget = rfq.budgetAmount != null ? toNumber(rfq.budgetAmount) : null;
  let budgetWarning: string | null = null;
  if (budget && lowest && lowest > budget) {
    budgetWarning = `Lowest quote exceeds budget by ${Math.round(((lowest - budget) / budget) * 100)}%`;
  }

  const seasonalInsight =
    rfq.seasonalWindow && SEASONAL_INSIGHTS[rfq.seasonalWindow]
      ? SEASONAL_INSIGHTS[rfq.seasonalWindow]
      : SEASONAL_INSIGHTS.default;

  return {
    id: rfq.id,
    rfqNumber: rfq.rfqNumber,
    title: rfq.title,
    status: rfq.status,
    productName: rfq.productName,
    quantity: rfq.quantity != null ? toNumber(rfq.quantity) : null,
    unit: rfq.unit,
    dueDate: rfq.dueDate?.toISOString() ?? null,
    notes: rfq.notes,
    budgetAmount: budget,
    baselinePrice: rfq.baselinePrice != null ? toNumber(rfq.baselinePrice) : null,
    budgetWarning,
    specTamarindGrade: rfq.specTamarindGrade,
    specMoistureMaxPct: rfq.specMoistureMaxPct != null ? toNumber(rfq.specMoistureMaxPct) : null,
    specPulpYieldMinPct: rfq.specPulpYieldMinPct != null ? toNumber(rfq.specPulpYieldMinPct) : null,
    specAcidityMin: rfq.specAcidityMin != null ? toNumber(rfq.specAcidityMin) : null,
    packagingRequirements: rfq.packagingRequirements,
    moqRequired: rfq.moqRequired != null ? toNumber(rfq.moqRequired) : null,
    sourcingType: rfq.sourcingType,
    auctionMode: rfq.auctionMode,
    auctionEndsAt: rfq.auctionEndsAt?.toISOString() ?? null,
    negotiationDeadline: rfq.negotiationDeadline?.toISOString() ?? null,
    seasonalWindow: rfq.seasonalWindow,
    seasonalInsight,
    awardedVendorId: rfq.awardedVendorId,
    awardedVendorName: rfq.awardedVendor?.name ?? null,
    aiRecommendedVendorId: rfq.aiRecommendedVendorId ?? top?.vendorId ?? null,
    aiRecommendedVendorName: rfq.aiRecommendedVendor?.name ?? top?.vendorName ?? null,
    aiRecommendationReason: aiReason,
    purchaseId: rfq.purchases[0]?.id ?? null,
    purchaseNumber: rfq.purchases[0]?.purchaseNumber ?? null,
    sentAt: rfq.sentAt?.toISOString() ?? null,
    comparisonStartedAt: rfq.comparisonStartedAt?.toISOString() ?? null,
    approvedAt: rfq.approvedAt?.toISOString() ?? null,
    awardedAt: rfq.awardedAt?.toISOString() ?? null,
    matrix,
    timeline: rfq.events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      title: e.title,
      detail: e.detail,
      createdAt: e.createdAt.toISOString(),
      vendorName: e.vendor?.name ?? null,
    })),
    negotiations: rfq.negotiations.map((n) => ({
      id: n.id,
      round: n.round,
      offeredBy: n.offeredBy,
      vendorName: n.quote.vendor.name,
      unitPrice: toNumber(n.unitPrice),
      notes: n.notes,
      createdAt: n.createdAt.toISOString(),
    })),
    fpoComparison: { fpoAvgPrice: fpoAvg, commercialAvgPrice: commAvg, fpoSavingsPct },
  };
}

export async function getRfqAnalytics(): Promise<RfqAnalytics> {
  const kpis = await getRfqSourcingKpis();
  const rfqs = await safeModelFindMany<{ status: RFQStatus; sentAt: Date | null; quotes: { quotedAt: Date }[] }>(
    "procurementRFQ",
    { include: { quotes: { select: { quotedAt: true } } } },
  );

  const statusDistribution = ["DRAFT", "SENT", "QUOTED", "COMPARED", "APPROVED", "AWARDED", "CLOSED"].map(
    (status) => ({
      status,
      count: rfqs.filter((r) => r.status === status).length,
    }),
  );

  const responseTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const label = d.toLocaleString("en-IN", { month: "short" });
    const inMonth = rfqs.filter((r) => r.sentAt && r.sentAt.getMonth() === d.getMonth());
    let hours = 0;
    let c = 0;
    for (const r of inMonth) {
      for (const q of r.quotes) {
        if (r.sentAt) {
          hours += Math.max(1, Math.round((q.quotedAt.getTime() - r.sentAt.getTime()) / 3600000));
          c += 1;
        }
      }
    }
    return { month: label, hours: c ? Math.round(hours / c) : 0 };
  });

  return {
    savingsPct: kpis.procurementSavingsPct,
    avgResponseHours: kpis.avgResponseHours,
    avgNegotiationDays: kpis.avgNegotiationDays,
    conversionRatePct: kpis.conversionRatePct,
    responseTrend,
    statusDistribution,
  };
}

/** @deprecated Use getRfqList — kept for vendor-metrics compatibility */
export async function getRfqs() {
  return getRfqList();
}
