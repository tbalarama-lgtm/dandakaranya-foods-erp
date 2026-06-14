import { notFound } from "next/navigation";
import { ApprovalDetailHub } from "@/components/procurement/approval-detail-hub";
import { getApprovalDetail } from "@/lib/approval-metrics";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ purchaseId: string }>;
}) {
  const user = await requirePermission("purchases.view");
  const { purchaseId } = await params;
  const detail = await getApprovalDetail(purchaseId);
  if (!detail) notFound();

  return (
    <ApprovalDetailHub detail={detail} canEdit={can(user.role, "purchases.edit")} />
  );
}
