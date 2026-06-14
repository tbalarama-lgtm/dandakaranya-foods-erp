import type { ProductionStatus } from "@prisma/client";

export type AnalyticsReportMetrics = {
  dateRange: { from: Date; to: Date; preset: string };
  branchId?: string;
  branches: { id: string; name: string; code: string }[];
  totalSales: number;
  totalPurchases: number;
  profit: number;
  profitMargin: number;
  gstCollected: number;
  paidSales: number;
  inventoryValue: number;
  expensesTotal: number;
  growth: {
    revenuePct: number;
    purchasesPct: number;
    profitPct: number;
    expensesPct: number;
  };
  revenueTrend: { month: string; revenue: number; purchases: number; expenses: number }[];
  expenseBreakdown: { category: string; amount: number }[];
  gstSummary: { collected: number; onPurchases: number; net: number };
  userPerformance: { name: string; revenue: number; orders: number }[];
  leadFunnel: {
    stages: { stage: string; count: number; rate: number }[];
    total: number;
    conversionRate: number;
  };
  forecast: { nextMonthRevenue: number; series: number[] };
  procurement: {
    vendorCount: number;
    topVendors: { name: string; amount: number; orders: number }[];
    topVendorShare: number;
    rawMaterialTrend: { month: string; amount: number }[];
  };
  foodManufacturing: {
    batchesCompleted: number;
    batchYield: number;
    wastagePct: number;
    qcRejectionRate: number;
    expiringCount: number;
    productionEfficiency: number;
    byStatus: { status: ProductionStatus; count: number }[];
  };
  sparklines: {
    revenue: number[];
    profit: number[];
    expenses: number[];
  };
  auditTrail: {
    periodLabel: string;
    generatedAt: string;
    gstRegistered: boolean;
  };
};
