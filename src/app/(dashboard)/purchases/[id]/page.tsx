import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { PoDetailHub } from "@/components/purchases/po-detail-hub";
import { getPoDetail } from "@/lib/po-metrics";
import { PO_STATUS_LABELS } from "@/lib/po-types";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("purchases.view");
  const { id } = await params;
  const po = await getPoDetail(id);
  if (!po) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={po.purchaseNumber}
        description={`${po.vendorName} · ${PO_STATUS_LABELS[po.poStatus]} · ${po.lineItems.length} line(s)`}
        action={{ label: "All POs", href: "/purchases" }}
      />
      <PoDetailHub po={po} />
    </div>
  );
}
