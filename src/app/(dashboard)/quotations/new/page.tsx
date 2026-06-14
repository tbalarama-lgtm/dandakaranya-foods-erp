import { PageHeader } from "@/components/layout/page-header";
import { QuotationBuilder } from "@/components/quotations/quotation-builder";
import { prisma } from "@/lib/db";
import { serializeProducts } from "@/lib/serialize-prisma";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; leadId?: string }>;
}) {
  await requirePermission("sales.create");
  const sp = await searchParams;

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, company: true } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New quotation"
        description="Build a commercial proposal with GST breakdown, export terms, and discounts"
        action={{ label: "Back to quotes", href: "/quotations" }}
      />
      <QuotationBuilder
        customers={customers}
        products={serializeProducts(products)}
        defaultCustomerId={sp.customerId}
        defaultLeadId={sp.leadId}
      />
    </div>
  );
}
