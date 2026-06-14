import { HrPageHeader } from "@/components/hr/hr-page-header";
import { PayrollClient } from "@/components/hr/payroll-client";
import { getPayrollRecords } from "@/lib/hr/payroll-service";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const { records, period, source } = await getPayrollRecords();

  return (
    <>
      <HrPageHeader
        title="Payroll management"
        description="Salary structure, allowances, deductions, PF/ESI, payslips, and payroll history."
      />
      <PayrollClient
        initialRecords={records}
        periodLabel={period.label}
        dataSource={source}
      />
    </>
  );
}
