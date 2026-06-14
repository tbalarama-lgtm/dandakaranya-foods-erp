import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceStatusBadge } from "@/components/sales/invoice-status-badge";
import {
  InvoiceDetailActions,
  InvoiceLineItemsTable,
} from "@/components/sales/invoice-detail-actions";
import { prisma } from "@/lib/db";
import { serializeInvoiceItems } from "@/lib/invoice-serialize";
import { INVOICE_TAX_MODE_LABELS } from "@/lib/invoice-types";
import { formatDate, formatInr, toNumber } from "@/lib/utils";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("sales.view");
  const { id } = await params;

  const inv = await prisma.saleInvoice.findUnique({
    where: { id },
    include: {
      customer: true,
      user: { select: { name: true } },
      warehouse: { select: { name: true } },
      salesOrder: { select: { orderNumber: true, deliveryStatus: true } },
      quotation: { select: { quoteNumber: true } },
      items: { include: { product: true } },
      payments: { orderBy: { paidAt: "desc" } },
      creditNotes: { orderBy: { createdAt: "desc" } },
      reminders: { orderBy: { sentAt: "desc" }, take: 10 },
    },
  });

  if (!inv) notFound();

  const items = serializeInvoiceItems(inv.items);
  const total = toNumber(inv.total);
  const paid = toNumber(inv.paidAmount);
  const balance = Math.max(0, total - paid);

  return (
    <div className="space-y-6">
      <PageHeader
        title={inv.invoiceNumber}
        description={`${inv.customer.name} · ${inv.user?.name ?? "—"} · ${inv.warehouse?.name ?? "Default warehouse"}`}
        action={{ label: "Back to billing", href: "/sales" }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <InvoiceStatusBadge status={inv.status} />
        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold">
          {INVOICE_TAX_MODE_LABELS[inv.taxMode]}
        </span>
        <span className="text-sm text-muted-foreground">
          Due {inv.dueDate ? formatDate(inv.dueDate) : "—"}
        </span>
        {inv.stockDeducted && (
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            Stock deducted
          </span>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="erp-kpi-card p-5">
            <h3 className="text-sm font-semibold">Product breakdown</h3>
            <div className="mt-4">
              <InvoiceLineItemsTable items={items} />
            </div>
            <dl className="mt-4 grid gap-2 border-t border-border/50 pt-4 text-sm sm:grid-cols-2">
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium">{formatInr(toNumber(inv.subtotal))}</dd>
              </div>
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground">Discount</dt>
                <dd>{formatInr(toNumber(inv.discountAmount))}</dd>
              </div>
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground">Freight</dt>
                <dd>{formatInr(toNumber(inv.shippingAmount))}</dd>
              </div>
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground">CGST / SGST / IGST</dt>
                <dd>
                  {formatInr(toNumber(inv.cgstAmount))} / {formatInr(toNumber(inv.sgstAmount))} /{" "}
                  {formatInr(toNumber(inv.igstAmount))}
                </dd>
              </div>
              <div className="flex justify-between sm:col-span-2 sm:block">
                <dt className="text-muted-foreground">Invoice total</dt>
                <dd className="text-xl font-bold text-[#B68D40]">
                  {inv.currency === "INR"
                    ? formatInr(total)
                    : `${inv.currency} ${total.toLocaleString()}`}
                </dd>
              </div>
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground">Paid</dt>
                <dd className="text-emerald-700">{formatInr(paid)}</dd>
              </div>
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground">Balance due</dt>
                <dd className="font-semibold text-amber-700">{formatInr(balance)}</dd>
              </div>
            </dl>
          </div>

          {(inv.incoterms || inv.customsReference || inv.shippingDocRef) && (
            <div className="erp-kpi-card p-5">
              <h3 className="text-sm font-semibold">Export & shipping</h3>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                {[
                  ["Incoterms", inv.incoterms],
                  ["Customs ref.", inv.customsReference],
                  ["Shipping docs", inv.shippingDocRef],
                  ["Currency", inv.currency],
                ].map(([label, val]) => (
                  <div key={label} className="rounded-lg bg-muted/40 px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
                    <dd className="font-medium">{val || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {(inv.eInvoiceIrn || inv.eWayBillNumber) && (
            <div className="erp-kpi-card p-5">
              <h3 className="text-sm font-semibold">GST compliance</h3>
              <dl className="mt-2 space-y-1 text-sm">
                {inv.eInvoiceIrn && (
                  <div>
                    <span className="text-muted-foreground">e-Invoice IRN: </span>
                    <span className="font-mono text-xs">{inv.eInvoiceIrn}</span>
                  </div>
                )}
                {inv.eWayBillNumber && (
                  <div>
                    <span className="text-muted-foreground">e-Way bill: </span>
                    <span className="font-mono">{inv.eWayBillNumber}</span>
                  </div>
                )}
              </dl>
            </div>
          )}

          <div className="erp-kpi-card p-5">
            <h3 className="text-sm font-semibold">Workflow chain</h3>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {inv.quotation && (
                <Link href={`/quotations/${inv.quotationId}`} className="rounded-lg bg-muted px-3 py-2 hover:text-[#B68D40]">
                  Quote: {inv.quotation.quoteNumber}
                </Link>
              )}
              {inv.salesOrder && (
                <Link href="/sales/orders" className="rounded-lg bg-muted px-3 py-2 hover:text-[#B68D40]">
                  Order: {inv.salesOrder.orderNumber} · {inv.salesOrder.deliveryStatus}
                </Link>
              )}
              <span className="rounded-lg bg-[#B68D40]/15 px-3 py-2 font-medium text-[#967235]">
                Invoice: {inv.invoiceNumber}
              </span>
              <Link href={`/customers/${inv.customerId}?tab=ledger`} className="rounded-lg bg-muted px-3 py-2 hover:text-[#B68D40]">
                Customer ledger →
              </Link>
            </div>
          </div>

          {inv.creditNotes.length > 0 && (
            <div className="erp-kpi-card p-5">
              <h3 className="text-sm font-semibold">Credit notes</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {inv.creditNotes.map((cn) => (
                  <li key={cn.id} className="rounded-lg border border-border/50 px-3 py-2">
                    <span className="font-medium">{cn.creditNoteNumber}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{cn.status}</span>
                    <p className="text-xs">{cn.reason}</p>
                    <p className="font-semibold">{formatInr(toNumber(cn.total))}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-6 xl:sticky xl:top-4 xl:self-start">
          <InvoiceDetailActions
            invoice={{
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              status: inv.status,
              total,
              paidAmount: paid,
              balance,
              customerId: inv.customerId,
              customerEmail: inv.customer.email,
              customerPhone: inv.customer.phone,
              eInvoiceIrn: inv.eInvoiceIrn,
              eWayBillNumber: inv.eWayBillNumber,
              items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
            }}
            payments={inv.payments.map((p) => ({
              id: p.id,
              amount: toNumber(p.amount),
              paymentMode: p.paymentMode,
              utr: p.utr,
              reference: p.reference,
              reconciled: p.reconciled,
              paidAt: p.paidAt.toISOString(),
            }))}
          />

          {inv.reminders.length > 0 && (
            <div className="erp-kpi-card p-5">
              <h3 className="text-sm font-semibold">Reminder log</h3>
              <ul className="mt-3 space-y-1 text-xs">
                {inv.reminders.map((r) => (
                  <li key={r.id}>
                    {r.channel} → {r.toAddress} · {formatDate(r.sentAt)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
