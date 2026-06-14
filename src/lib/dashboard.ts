import { getErpDashboardMetrics } from "./erp-metrics";

export { getErpDashboardMetrics };

/** Backward-compatible shape for StatCards */
export async function getDashboardMetrics() {
  const m = await getErpDashboardMetrics();
  return {
    totalSales: m.totalSales,
    totalPurchases: m.totalPurchases,
    pendingPayments: m.pendingPayments,
    inventoryValue: m.inventoryValue,
    leadsCount: m.leadsCount,
    lowStock: m.lowStock,
    revenueByMonth: m.revenueByMonth.map(({ month, revenue }) => ({ month, revenue })),
    topProducts: m.topProducts,
    recentActivity: m.recentActivity,
    notifications: m.notifications,
    monthSales: m.monthSales,
  };
}
