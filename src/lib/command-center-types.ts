import type { DeliveryStatus, ProductionStatus } from "@prisma/client";

export type CommandCenterMetrics = {
  totalSales: number;
  totalPurchases: number;
  monthSales: number;
  prevMonthSales: number;
  salesTrendPct: number;
  revenueTrendPct: number;
  pendingPayments: number;
  pendingOrders: number;
  inventoryValue: number;
  inventoryTrendPct: number;
  inventoryStatus: { totalSkus: number; lowStockCount: number; inStock: number };
  productionOverview: { activeBatches: number; todayOutput: number; planned: number; completed: number };
  leadsCount: number;
  leadConversionRatio: number;
  leadPipeline: { stage: string; count: number }[];
  revenueYtd: number;
  expensesMonth: number;
  employeesActive: number;
  pendingLeaves: number;
  deliveryPending: number;
  lowStock: { id: string; name: string; stockQty?: unknown; minStockQty?: unknown }[];
  revenueByMonth: { month: string; revenue: number; purchases: number }[];
  inventoryMovement: { month: string; inbound: number; outbound: number }[];
  productionByStatus: { status: ProductionStatus; count: number }[];
  procurement: {
    pendingApprovals: number;
    vendorCount: number;
    monthPurchases: number;
    openGrn: number;
  };
  pendingApprovals: { purchases: number; documents: number; total: number };
  topProducts: { name: string; qty: number }[];
  recentActivity: { id: string; message: string; userName: string | null; createdAt: Date }[];
  notifications: { id: string; title: string; message: string; link: string | null; createdAt?: Date }[];
  foodManufacturing: {
    activeBatches: number;
    expiringWithin30Days: number;
    expiringItems: { id: string; batchNumber: string; productName: string; expiryDate: Date }[];
    qualityChecksPending: number;
    fssaiCompliant: boolean;
    gstRegistered: boolean;
    traceabilityScore: number;
  };
  warehouses: { id: string; name: string; code: string; city: string | null }[];
  liveDeliveries: {
    id: string;
    invoiceNumber: string;
    customer: string;
    status: DeliveryStatus;
    total: number;
  }[];
  financeSummary: {
    revenueYtd: number;
    expensesMonth: number;
    pendingReceivables: number;
    pendingPayables: number;
    netMonth: number;
  };
  hrPayroll: {
    employeesActive: number;
    pendingLeaves: number;
    attendanceToday: number;
  };
  kpiSparklines: {
    sales: number[];
    inventory: number[];
    production: number[];
  };
  /** Set when Supabase/Postgres is unreachable; dashboard shows empty KPIs + banner */
  databaseOffline?: boolean;
};

export type CommandCenterRole = import("@prisma/client").UserRole;

export function trendLabel(pct: number) {
  if (pct > 0) return `+${pct.toFixed(1)}%`;
  if (pct < 0) return `${pct.toFixed(1)}%`;
  return "0%";
}

export function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
