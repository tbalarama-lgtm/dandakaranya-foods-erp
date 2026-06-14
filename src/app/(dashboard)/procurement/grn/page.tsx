import { PageHeader } from "@/components/layout/page-header";
import { GrnExecutionHub } from "@/components/procurement/grn-execution-hub";
import { getDeliveredPosAwaitingGrn, getGrnExecutionKpis, getGrnList, getSupplierQcTrends } from "@/lib/grn-metrics";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function GrnPage() {
  const user = await requirePermission("purchases.view");
  const [grns, kpis, qcTrends, awaitingAuto] = await Promise.all([
    getGrnList(),
    getGrnExecutionKpis(),
    getSupplierQcTrends(),
    getDeliveredPosAwaitingGrn(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="GRN & Quality Control"
        description="Goods receipt · warehouse intake · food QC · batch traceability · FSSAI/HACCP compliance"
        action={
          can(user.role, "purchases.edit")
            ? { label: "Mobile receive", href: "/procurement/grn/receive" }
            : { label: "Procurement hub", href: "/procurement" }
        }
      />
      <GrnExecutionHub grns={grns} kpis={kpis} qcTrends={qcTrends} awaitingAuto={awaitingAuto} />
    </div>
  );
}
