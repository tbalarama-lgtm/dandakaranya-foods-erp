import type { AnalyticsReportMetrics } from "@/lib/analytics-types";
import { formatInr } from "@/lib/utils";

export function metricsToCsv(m: AnalyticsReportMetrics): string {
  const rows = [
    ["Dandakaranya Foods — Analytics Report"],
    ["Period", m.auditTrail.periodLabel],
    ["Generated", m.auditTrail.generatedAt],
    ["Branch", m.branchId ?? "All branches"],
    [],
    ["Metric", "Value"],
    ["Total Sales", m.totalSales],
    ["Total Purchases", m.totalPurchases],
    ["Expenses", m.expensesTotal],
    ["Profit", m.profit],
    ["Profit Margin %", m.profitMargin.toFixed(2)],
    ["GST Collected", m.gstCollected],
    ["Inventory Value", m.inventoryValue],
    [],
    ["Growth — Revenue %", m.growth.revenuePct],
    ["Growth — Purchases %", m.growth.purchasesPct],
    [],
    ["Expense Category", "Amount"],
    ...m.expenseBreakdown.map((e) => [e.category, e.amount]),
    [],
    ["Vendor", "Amount", "Orders"],
    ...m.procurement.topVendors.map((v) => [v.name, v.amount, v.orders]),
    [],
    ["Lead Stage", "Count", "Rate %"],
    ...m.leadFunnel.stages.map((s) => [s.stage, s.count, s.rate]),
  ];
  return rows.map((r) => r.join(",")).join("\n");
}

export function downloadCsv(m: AnalyticsReportMetrics) {
  const blob = new Blob([metricsToCsv(m)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dandakaranya-analytics-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadExcel(m: AnalyticsReportMetrics) {
  // Excel-compatible TSV export
  const csv = metricsToCsv(m).replace(/,/g, "\t");
  const blob = new Blob([csv], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dandakaranya-analytics-${Date.now()}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPdf(m: AnalyticsReportMetrics) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 16;
  const line = (text: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(text, 14, y);
    y += 7;
    if (y > 270) {
      doc.addPage();
      y = 16;
    }
  };

  line("Dandakaranya Foods — Business Intelligence Report", true);
  line(`Period: ${m.auditTrail.periodLabel}`);
  line(`Generated: ${new Date(m.auditTrail.generatedAt).toLocaleString("en-IN")}`);
  y += 4;
  line("Financial Summary", true);
  line(`Total Sales: ${formatInr(m.totalSales)}`);
  line(`Purchases: ${formatInr(m.totalPurchases)}`);
  line(`Expenses: ${formatInr(m.expensesTotal)}`);
  line(`Profit: ${formatInr(m.profit)} (${m.profitMargin.toFixed(1)}% margin)`);
  line(`GST Net: ${formatInr(m.gstSummary.net)}`);
  y += 4;
  line("Growth vs Prior Period", true);
  line(`Revenue: ${m.growth.revenuePct}%`);
  line(`Purchases: ${m.growth.purchasesPct}%`);
  y += 4;
  line("Lead Conversion", true);
  line(`Rate: ${m.leadFunnel.conversionRate}%`);
  line(`Forecast (next month): ${formatInr(m.forecast.nextMonthRevenue)}`);
  doc.save(`dandakaranya-analytics-${Date.now()}.pdf`);
}

export function downloadJson(m: AnalyticsReportMetrics) {
  const blob = new Blob([JSON.stringify(m, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dandakaranya-analytics-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
