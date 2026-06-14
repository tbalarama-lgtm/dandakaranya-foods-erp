import type { AnalyticsReportMetrics } from "@/lib/analytics-types";
import { formatInr } from "@/lib/utils";

export type BusinessInsight = {
  id: string;
  severity: "info" | "positive" | "warning" | "critical";
  title: string;
  body: string;
};

export function generateBusinessInsights(m: AnalyticsReportMetrics): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  if (m.growth.revenuePct > 10) {
    insights.push({
      id: "rev-up",
      severity: "positive",
      title: "Strong revenue momentum",
      body: `Revenue grew ${m.growth.revenuePct}% vs the prior period (${formatInr(m.totalSales)}). Sales trend is accelerating — consider increasing production capacity for top SKUs.`,
    });
  } else if (m.growth.revenuePct < -5) {
    insights.push({
      id: "rev-down",
      severity: "warning",
      title: "Revenue decline detected",
      body: `Sales dropped ${Math.abs(m.growth.revenuePct)}% compared to the previous period. Review lead pipeline conversion and pending receivables (${formatInr(m.paidSales)} collected vs ${formatInr(m.totalSales)} invoiced).`,
    });
  }

  if (m.profitMargin < 15 && m.totalSales > 0) {
    insights.push({
      id: "margin",
      severity: "warning",
      title: "Profit margin under pressure",
      body: `Gross margin is ${m.profitMargin.toFixed(1)}%. Procurement spend (${formatInr(m.totalPurchases)}) may be eroding margins — review vendor pricing and raw material costs.`,
    });
  } else if (m.profitMargin >= 20) {
    insights.push({
      id: "margin-ok",
      severity: "positive",
      title: "Healthy profit margin",
      body: `Margin at ${m.profitMargin.toFixed(1)}% indicates efficient operations. GST collected: ${formatInr(m.gstCollected)} — ensure GSTR-1 filing aligns with invoice data.`,
    });
  }

  if (m.leadFunnel.conversionRate < 15 && m.leadFunnel.total > 0) {
    insights.push({
      id: "leads",
      severity: "info",
      title: "Pipeline conversion opportunity",
      body: `Only ${m.leadFunnel.conversionRate}% of leads converted. Focus on Negotiation stage (${m.leadFunnel.stages.find((s) => s.stage === "Negotiation")?.count ?? 0} leads) — forecast suggests ${formatInr(m.forecast.nextMonthRevenue)} potential next month.`,
    });
  }

  if (m.foodManufacturing.expiringCount > 0) {
    insights.push({
      id: "expiry",
      severity: "critical",
      title: "Expiry risk in inventory",
      body: `${m.foodManufacturing.expiringCount} batch(es) expire within 30 days. Prioritize FEFO dispatch and review QC rejection rate (${m.foodManufacturing.qcRejectionRate}%).`,
    });
  }

  if (m.procurement.topVendorShare > 60) {
    insights.push({
      id: "vendor-conc",
      severity: "warning",
      title: "Supplier concentration risk",
      body: `Top vendor represents ${m.procurement.topVendorShare}% of procurement. Diversify sourcing for raw materials to reduce supply chain risk.`,
    });
  }

  if (m.foodManufacturing.batchYield < 85 && m.foodManufacturing.batchesCompleted > 0) {
    insights.push({
      id: "yield",
      severity: "warning",
      title: "Batch yield below target",
      body: `Average yield is ${m.foodManufacturing.batchYield}%. Investigate wastage (${m.foodManufacturing.wastagePct}% of planned output) and production efficiency metrics.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "stable",
      severity: "info",
      title: "Operations stable",
      body: "Key metrics are within normal ranges for this period. Continue monitoring inventory value and pending approvals for audit readiness.",
    });
  }

  return insights;
}
