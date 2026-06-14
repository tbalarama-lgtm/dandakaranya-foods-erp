import { FinancePageHeader } from "@/components/finance/finance-page-header";
import { FinanceReportsClient } from "@/components/finance/finance-reports-client";

export default function FinanceReportsPage() {
  return (
    <>
      <FinancePageHeader
        title="Financial reports"
        description="P&L, balance sheet, cash flow, trial balance, sales, expense, and tax reports — PDF & Excel export."
      />
      <FinanceReportsClient />
    </>
  );
}
