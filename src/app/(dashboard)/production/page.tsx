import { ProductionPageHeader } from "@/components/production/production-page-header";
import { ProductionGovernanceHub } from "@/components/production/production-governance-hub";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getProductionHubBundle } from "@/lib/production-metrics";

export const dynamic = "force-dynamic";

export default async function ProductionOverviewPage() {
  const user = await getCurrentUser();
  const bundle = await getProductionHubBundle();
  const canEdit = user ? can(user.role, "production.manage") : false;

  return (
    <>
      <ProductionPageHeader
        title="MES control center"
        description="Manufacturing execution — scheduling, MRP, OEE, batch workflows, and food processing intelligence."
      />
      <ProductionGovernanceHub bundle={bundle} canEdit={canEdit} />
    </>
  );
}
