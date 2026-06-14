import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { OrderRowActions } from "@/components/sales/order-row-actions";
import { InvoiceStatusBadge } from "@/components/sales/invoice-status-badge";
import {
  DataTableShell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableBody,
  DataTableRow,
  DataTableCell,
} from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr, toNumber } from "@/lib/utils";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SalesOrdersPage() {
  await requirePermission("sales.view");
  const orders = await prisma.salesOrder.findMany({
    orderBy: { orderDate: "desc" },
    take: 100,
    include: {
      customer: { select: { name: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true } },
      quotation: { select: { quoteNumber: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales orders"
        description="Quotation → Order → Invoice → Payment → Dispatch workflow"
        action={{ label: "New invoice", href: "/sales/new" }}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/quotations">Quotations</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/sales">All invoices</Link>
            </Button>
          </>
        }
      />

      <DataTableShell>
        <DataTableHead>
          <tr>
            <DataTableHeaderCell>Order #</DataTableHeaderCell>
            <DataTableHeaderCell>Customer</DataTableHeaderCell>
            <DataTableHeaderCell>Quote</DataTableHeaderCell>
            <DataTableHeaderCell>Status</DataTableHeaderCell>
            <DataTableHeaderCell>Delivery</DataTableHeaderCell>
            <DataTableHeaderCell>Total</DataTableHeaderCell>
            <DataTableHeaderCell>Invoice</DataTableHeaderCell>
            <DataTableHeaderCell>Date</DataTableHeaderCell>
            <DataTableHeaderCell>Actions</DataTableHeaderCell>
          </tr>
        </DataTableHead>
        <DataTableBody>
          {orders.map((o) => (
            <DataTableRow key={o.id}>
              <DataTableCell className="font-mono text-xs font-semibold">{o.orderNumber}</DataTableCell>
              <DataTableCell>{o.customer.name}</DataTableCell>
              <DataTableCell className="text-xs text-muted-foreground">
                {o.quotation?.quoteNumber ?? "—"}
              </DataTableCell>
              <DataTableCell>
                <Badge variant="muted">{o.status}</Badge>
              </DataTableCell>
              <DataTableCell>
                <Badge>{o.deliveryStatus}</Badge>
              </DataTableCell>
              <DataTableCell>{formatInr(toNumber(o.total))}</DataTableCell>
              <DataTableCell>
                {o.invoice ? (
                  <div className="flex flex-col gap-1">
                    <Link href={`/sales/${o.invoice.id}`} className="text-xs font-semibold hover:text-[#B68D40]">
                      {o.invoice.invoiceNumber}
                    </Link>
                    <InvoiceStatusBadge status={o.invoice.status} />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </DataTableCell>
              <DataTableCell className="text-muted-foreground">{formatDate(o.orderDate)}</DataTableCell>
              <DataTableCell>
                <OrderRowActions
                  orderId={o.id}
                  orderNumber={o.orderNumber}
                  hasInvoice={Boolean(o.invoice)}
                  invoiceId={o.invoice?.id ?? null}
                />
              </DataTableCell>
            </DataTableRow>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                No sales orders yet. Convert a quotation from CRM or Leads.
              </td>
            </tr>
          )}
        </DataTableBody>
      </DataTableShell>
    </div>
  );
}
