import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { GrnDetailHub } from "@/components/procurement/grn-detail-hub";
import { getGrnDetail } from "@/lib/grn-metrics";
import { GRN_LIFECYCLE_LABELS } from "@/lib/grn-types";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function GrnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("purchases.view");
  const { id } = await params;
  const grn = await getGrnDetail(id);
  if (!grn) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={grn.grnNumber}
        description={`${grn.vendorName} · ${GRN_LIFECYCLE_LABELS[grn.lifecycle]} · ${grn.lineItems.length} line(s)`}
        action={{ label: "All GRNs", href: "/procurement/grn" }}
      />
      <GrnDetailHub grn={grn} canEdit={can(user.role, "purchases.edit")} />
    </div>
  );
}
