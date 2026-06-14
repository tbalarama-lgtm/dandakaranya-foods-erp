import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { RfqDetailHub } from "@/components/procurement/rfq-detail-hub";
import { getRfqDetail } from "@/lib/rfq-metrics";
import { RFQ_STATUS_LABELS } from "@/lib/rfq-types";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RFQDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("purchases.view");
  const { id } = await params;
  const [rfq, vendors] = await Promise.all([
    getRfqDetail(id),
    prisma.vendor.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 40,
    }),
  ]);
  if (!rfq) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={rfq.title}
        description={`${rfq.rfqNumber} · ${RFQ_STATUS_LABELS[rfq.status]}${rfq.awardedVendorName ? ` · ${rfq.awardedVendorName}` : ""}`}
        action={{ label: "All RFQs", href: "/procurement/rfq" }}
      />
      <RfqDetailHub rfq={rfq} vendors={vendors} />
    </div>
  );
}
