import { FinancePageHeader } from "@/components/finance/finance-page-header";
import { FinanceCashFlowChart } from "@/components/finance/finance-cash-flow-chart";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { getFinanceDashboardMetrics } from "@/lib/finance/mock-data";

export default function CashFlowPage() {
  const m = getFinanceDashboardMetrics();

  return (
    <>
      <FinancePageHeader title="Cash flow statement" description="Inflows vs outflows — operating cash movement." />
      <GlassCard>
        <GlassCardHeader>
          <h3 className="font-semibold">Cash flow trend</h3>
        </GlassCardHeader>
        <GlassCardBody className="h-[360px]">
          <FinanceCashFlowChart data={m.cashFlowSeries} />
        </GlassCardBody>
      </GlassCard>
    </>
  );
}
