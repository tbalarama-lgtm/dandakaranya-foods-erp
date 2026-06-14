import { FinancePageHeader } from "@/components/finance/finance-page-header";
import { FinanceDashboardClient } from "@/components/finance/finance-dashboard-client";
import { getFinanceDashboardMetrics } from "@/lib/finance/mock-data";

export default function ProfitLossPage() {
  const m = getFinanceDashboardMetrics();
  return (
    <>
      <FinancePageHeader title="Profit & loss" description="Monthly P&L trends and margin analysis." />
      <FinanceDashboardClient metrics={m} />
    </>
  );
}
