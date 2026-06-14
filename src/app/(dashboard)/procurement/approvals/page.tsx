import { PageHeader } from "@/components/layout/page-header";
import { ApprovalWorkflowHub } from "@/components/procurement/approval-workflow-hub";
import { getApprovalHubBundle } from "@/lib/approval-metrics";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ProcurementApprovalsPage() {
  const user = await requirePermission("purchases.view");
  const { rows, kpis, bottlenecks, slaTrend } = await getApprovalHubBundle(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement Approvals"
        description="Enterprise workflow governance — multi-level matrix, SLA tracking, budget validation, and food-manufacturing gates"
        action={{ label: "Procurement hub", href: "/procurement" }}
      />
      <ApprovalWorkflowHub
        rows={rows}
        kpis={kpis}
        bottlenecks={bottlenecks}
        slaTrend={slaTrend}
        canEdit={can(user.role, "purchases.edit")}
      />
    </div>
  );
}
