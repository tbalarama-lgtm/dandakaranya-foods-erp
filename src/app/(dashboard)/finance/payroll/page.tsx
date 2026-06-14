import { FinancePageHeader } from "@/components/finance/finance-page-header";
import { FinancePayrollClient } from "@/components/finance/finance-payroll-client";

export default function FinancePayrollPage() {
  return (
    <>
      <FinancePageHeader
        title="Payroll finance"
        description="Salary processing, payouts, bonuses, deductions — integrated with HR payroll."
      />
      <FinancePayrollClient />
    </>
  );
}
