import { PageHeader } from "@/components/layout/page-header";
import { QualityPlatform } from "@/components/quality/quality-platform";
import { getQualityHubAnalytics } from "@/lib/quality-metrics";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function QualityPage() {
  await requirePermission("production.view");
  const analytics = await getQualityHubAnalytics();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quality Control Center"
        description="GRN inspection · production QC · batch traceability · FSSAI/HACCP compliance for Bastar forest produce"
      />
      <QualityPlatform analytics={analytics} />
    </div>
  );
}
