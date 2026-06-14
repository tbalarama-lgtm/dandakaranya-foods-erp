import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableShell, DataTableHead, DataTableHeaderCell, DataTableBody, DataTableRow, DataTableCell } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatInr, toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PurchaseApprovalsPage() {
  const purchases = await prisma.purchase.findMany({
    orderBy: { purchaseDate: "desc" },
    include: { vendor: { select: { name: true } } },
  });

  return (
    <div>
      <PageHeader title="Purchase approvals" description="Approval workflow for procurement and raw material orders." />
      <DataTableShell>
        <DataTableHead>
          <tr>
            <DataTableHeaderCell>PO #</DataTableHeaderCell>
            <DataTableHeaderCell>Vendor</DataTableHeaderCell>
            <DataTableHeaderCell>Approval</DataTableHeaderCell>
            <DataTableHeaderCell>Payment</DataTableHeaderCell>
            <DataTableHeaderCell>Total</DataTableHeaderCell>
            <DataTableHeaderCell>Date</DataTableHeaderCell>
          </tr>
        </DataTableHead>
        <DataTableBody>
          {purchases.map((p) => (
            <DataTableRow key={p.id}>
              <DataTableCell className="font-mono text-xs">{p.purchaseNumber}</DataTableCell>
              <DataTableCell>{p.vendor.name}</DataTableCell>
              <DataTableCell>
                <Badge>{p.approvalStatus}</Badge>
              </DataTableCell>
              <DataTableCell>
                <Badge variant="muted">{p.paymentStatus}</Badge>
              </DataTableCell>
              <DataTableCell>{formatInr(toNumber(p.total))}</DataTableCell>
              <DataTableCell className="text-muted-foreground">{formatDate(p.purchaseDate)}</DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTableShell>
    </div>
  );
}
