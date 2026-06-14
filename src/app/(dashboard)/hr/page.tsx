import { HrPageHeader } from "@/components/hr/hr-page-header";
import { HrDashboardClient } from "@/components/hr/hr-dashboard-client";
import { getHrDashboardMetrics } from "@/lib/hr/mock-data";

export const dynamic = "force-dynamic";

export default function HrOverviewPage() {
  const metrics = getHrDashboardMetrics();

  return (
    <>
      <HrPageHeader
        title="HR Dashboard"
        description="Workforce overview, attendance, payroll, recruitment, and performance — enterprise HR suite."
      />
      <HrDashboardClient metrics={metrics} />
    </>
  );
}
