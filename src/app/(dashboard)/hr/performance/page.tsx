import { HrPageHeader } from "@/components/hr/hr-page-header";
import { PerformanceClient } from "@/components/hr/performance-client";
import { MOCK_PERFORMANCE } from "@/lib/hr/mock-data";

export default function PerformancePage() {
  return (
    <>
      <HrPageHeader
        title="Performance & appraisal"
        description="KPI tracking, ratings, manager reviews, and productivity scorecards."
      />
      <PerformanceClient reviews={MOCK_PERFORMANCE} />
    </>
  );
}
