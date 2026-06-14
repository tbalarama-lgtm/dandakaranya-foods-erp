import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { RfqCreateForm } from "@/components/procurement/rfq-create-form";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewRfqPage() {
  await requirePermission("purchases.create");
  const vendors = await prisma.vendor.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, isFpoPartner: true },
    orderBy: { name: "asc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="New RFQ"
        description="Draft sourcing event with food specs, budget validation, and vendor invitations"
        action={{ label: "Back to RFQs", href: "/procurement/rfq" }}
      />
      <RfqCreateForm vendors={vendors} />
      <p className="text-sm text-muted-foreground">
        <Link href="/procurement/rfq" className="text-[#B68D40] hover:underline">
          Cancel
        </Link>
      </p>
    </div>
  );
}
