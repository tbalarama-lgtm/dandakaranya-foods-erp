import { PageHeader } from "@/components/layout/page-header";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { Badge } from "@/components/ui/badge";
import {
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
} from "@/components/shared/data-table";
import { prisma } from "@/lib/db";
import { formatInr, toNumber } from "@/lib/utils";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requirePermission("inventory.view");
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ include: { category: true }, orderBy: { name: "asc" } }),
    prisma.productCategory.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Products"
        description="SKU catalogue, barcodes, GST rates, and pricing"
        actions={<ProductFormDialog categories={categories} />}
      />
      <DataTableShell>
        <DataTableHead>
          <tr>
            <DataTableHeaderCell>SKU</DataTableHeaderCell>
            <DataTableHeaderCell>Name</DataTableHeaderCell>
            <DataTableHeaderCell>Category</DataTableHeaderCell>
            <DataTableHeaderCell>Cost</DataTableHeaderCell>
            <DataTableHeaderCell>Sale</DataTableHeaderCell>
            <DataTableHeaderCell>Stock</DataTableHeaderCell>
            <DataTableHeaderCell>Status</DataTableHeaderCell>
            <DataTableHeaderCell>Actions</DataTableHeaderCell>
          </tr>
        </DataTableHead>
        <DataTableBody>
          {products.map((p) => (
            <DataTableRow key={p.id}>
              <DataTableCell className="font-mono text-xs">{p.sku}</DataTableCell>
              <DataTableCell className="font-medium">{p.name}</DataTableCell>
              <DataTableCell>{p.category?.name ?? "—"}</DataTableCell>
              <DataTableCell>{formatInr(toNumber(p.costPrice))}</DataTableCell>
              <DataTableCell>{formatInr(toNumber(p.salePrice))}</DataTableCell>
              <DataTableCell>{toNumber(p.stockQty)} {p.unit}</DataTableCell>
              <DataTableCell>
                <Badge variant={p.active ? "success" : "muted"}>{p.active ? "Active" : "Inactive"}</Badge>
              </DataTableCell>
              <DataTableCell>
                <ProductFormDialog categories={categories} product={p} />
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTableShell>
    </div>
  );
}
