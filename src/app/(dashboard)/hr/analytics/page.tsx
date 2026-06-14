import { HrPageHeader } from "@/components/hr/hr-page-header";
import { HrAnalyticsClient } from "@/components/hr/hr-analytics-client";

export default function HrAnalyticsPage() {
  return (
    <>
      <HrPageHeader
        title="HR analytics"
        description="Workforce insights, turnover, payroll cost, and multi-branch metrics."
      />
      <HrAnalyticsClient />
    </>
  );
}
