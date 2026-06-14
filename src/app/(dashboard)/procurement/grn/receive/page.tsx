import { PageHeader } from "@/components/layout/page-header";
import { GrnMobileReceive } from "@/components/procurement/grn-mobile-receive";
import { getDeliveredPosAwaitingGrn } from "@/lib/grn-metrics";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function GrnMobileReceivePage() {
  await requirePermission("purchases.edit");
  const awaiting = await getDeliveredPosAwaitingGrn();

  return (
    <div className="space-y-6">
      <PageHeader title="Mobile receiving" description="Warehouse gate intake — scan & receive delivered POs" />
      <GrnMobileReceive awaiting={awaiting} />
    </div>
  );
}
