import { ApprovalMobileHub } from "@/components/procurement/approval-mobile-hub";
import { getApprovalWorkflowRows } from "@/lib/approval-metrics";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ApprovalMobilePage() {
  const user = await requirePermission("purchases.view");
  const rows = await getApprovalWorkflowRows({ queue: "MY_QUEUE" });

  return (
    <ApprovalMobileHub rows={rows} canEdit={can(user.role, "purchases.edit")} />
  );
}
