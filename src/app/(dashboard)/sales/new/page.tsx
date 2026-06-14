import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "@/components/sales/invoice-form";
import { prisma } from "@/lib/db";
import { serializeProducts } from "@/lib/serialize-prisma";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  await requirePermission("sales.create");
  const sp = await searchParams;
  const [customers, products, warehouses] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New invoice"
        description="Enterprise tax invoice with GST breakup, batch tracking, and inventory deduction"
        action={{ label: "Back to billing", href: "/sales" }}
      />
      <InvoiceForm
        customers={customers}
        products={serializeProducts(products)}
        warehouses={warehouses}
        defaultCustomerId={sp.customerId}
      />
    </div>
  );
}
