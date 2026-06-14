import { FinancePageHeader } from "@/components/finance/finance-page-header";
import { FinanceBudgetClient } from "@/components/finance/finance-budget-client";
import { MOCK_BUDGET } from "@/lib/finance/mock-data";

export default function FinanceBudgetPage() {
  return (
    <>
      <FinancePageHeader
        title="Budget & forecasting"
        description="Annual budgets, department planning, revenue forecast, and variance analysis."
      />
      <FinanceBudgetClient budget={MOCK_BUDGET} />
    </>
  );
}
