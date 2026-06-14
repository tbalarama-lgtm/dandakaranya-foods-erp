import { FinancePageHeader } from "@/components/finance/finance-page-header";
import { FinanceDashboardClient } from "@/components/finance/finance-dashboard-client";
import { getFinanceDashboardMetrics } from "@/lib/finance/mock-data";

export const dynamic = "force-dynamic";

export default function FinanceOverviewPage() {
  const metrics = getFinanceDashboardMetrics();

  return (
    <>
      <FinancePageHeader
        title="Finance overview"
        description="Enterprise financial control — revenue, expenses, cash flow, GST, and health indicators for manufacturing & FMCG operations."
      />
      <FinanceDashboardClient metrics={metrics} />
    </>
  );
}
