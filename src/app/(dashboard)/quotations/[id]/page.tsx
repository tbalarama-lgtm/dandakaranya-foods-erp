import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  QuotationDetailActions,
  QuotationLineItemsTable,
  QuotationStatusBadge,
} from "@/components/quotations/quotation-detail-actions";
import { prisma } from "@/lib/db";
import type { QuotationLineItem } from "@/lib/quotation-types";
import { QUOTE_TAX_MODE_LABELS } from "@/lib/quotation-types";
import { formatDate, formatInr } from "@/lib/utils";
import { requirePermission } from "@/lib/session";
import { toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("sales.view");
  const { id } = await params;

  const quote = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      lead: { select: { id: true, company: true, email: true } },
      user: { select: { name: true } },
      approvals: { orderBy: { createdAt: "desc" } },
      emailLogs: { orderBy: { sentAt: "desc" } },
      revisions: { orderBy: { revisionNumber: "desc" }, select: { id: true, quoteNumber: true, revisionNumber: true, status: true } },
      parent: { select: { id: true, quoteNumber: true } },
    },
  });

  if (!quote) notFound();

  const items = quote.items as QuotationLineItem[];

  return (
    <div className="space-y-6">
      <PageHeader
        title={quote.quoteNumber}
        description={`${quote.customer?.name ?? quote.lead?.company ?? "—"} · ${quote.user?.name ?? "Sales"} · Rev. ${quote.revisionNumber}`}
        action={{ label: "Back to quotes", href: "/quotations" }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <QuotationStatusBadge status={quote.status} />
        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold">
          {QUOTE_TAX_MODE_LABELS[quote.taxMode]}
        </span>
        <span className="text-sm text-muted-foreground">
          Valid until {quote.validUntil ? formatDate(quote.validUntil) : "—"}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="erp-kpi-card p-5">
            <h3 className="text-sm font-semibold">Line items</h3>
            <div className="mt-4">
              <QuotationLineItemsTable items={items} />
            </div>
            <dl className="mt-4 grid gap-2 border-t border-border/50 pt-4 text-sm sm:grid-cols-2">
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium">{formatInr(toNumber(quote.subtotal))}</dd>
              </div>
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>{formatInr(toNumber(quote.shippingAmount))}</dd>
              </div>
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground">Discount</dt>
                <dd>{formatInr(toNumber(quote.discountAmount))}</dd>
              </div>
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground">CGST / SGST / IGST</dt>
                <dd>
                  {formatInr(toNumber(quote.cgstAmount))} / {formatInr(toNumber(quote.sgstAmount))} /{" "}
                  {formatInr(toNumber(quote.igstAmount))}
                </dd>
              </div>
              <div className="flex justify-between sm:col-span-2 sm:block">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="text-xl font-bold text-[#B68D40]">
                  {quote.currency === "INR"
                    ? formatInr(toNumber(quote.total))
                    : `${quote.currency} ${toNumber(quote.total).toLocaleString()}`}
                </dd>
              </div>
            </dl>
          </div>

          {(quote.incoterms || quote.moq || quote.packagingConfig) && (
            <div className="erp-kpi-card p-5">
              <h3 className="text-sm font-semibold">Export commercial terms</h3>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                {[
                  ["Incoterms", quote.incoterms],
                  ["Pricing", quote.pricingTerms],
                  ["MOQ", quote.moq],
                  ["Packaging", quote.packagingConfig],
                  ["Containers", quote.containerQty],
                  ["Shelf life", quote.shelfLife],
                ].map(([label, val]) => (
                  <div key={label} className="rounded-lg bg-muted/40 px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
                    <dd className="font-medium">{val || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {quote.notes && (
            <div className="erp-kpi-card p-5">
              <h3 className="text-sm font-semibold">Customer notes</h3>
              <p className="mt-2 text-sm">{quote.notes}</p>
            </div>
          )}

          {quote.revisions.length > 0 && (
            <div className="erp-kpi-card p-5">
              <h3 className="text-sm font-semibold">Version history</h3>
              <ul className="mt-3 space-y-2">
                {quote.parent && (
                  <li className="text-sm">
                    Parent:{" "}
                    <Link href={`/quotations/${quote.parent.id}`} className="text-[#B68D40] hover:underline">
                      {quote.parent.quoteNumber}
                    </Link>
                  </li>
                )}
                {quote.revisions.map((r) => (
                  <li key={r.id} className="text-sm">
                    <Link href={`/quotations/${r.id}`} className="text-[#B68D40] hover:underline">
                      {r.quoteNumber}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">R{r.revisionNumber} · {r.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-6 xl:sticky xl:top-4 xl:self-start">
          <QuotationDetailActions
            quote={{
              id: quote.id,
              quoteNumber: quote.quoteNumber,
              status: quote.status,
              requiresApproval: quote.requiresApproval,
              customerEmail: quote.customer?.email ?? quote.lead?.email ?? null,
              signatureStatus: quote.signatureStatus,
            }}
          />

          {quote.approvals.length > 0 && (
            <div className="erp-kpi-card p-5">
              <h3 className="text-sm font-semibold">Approval workflow</h3>
              <ul className="mt-3 space-y-2 text-xs">
                {quote.approvals.map((a) => (
                  <li key={a.id} className="rounded-lg border border-border/50 px-3 py-2">
                    <span className="font-semibold">{a.status}</span>
                    <p className="text-muted-foreground">{a.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {quote.emailLogs.length > 0 && (
            <div className="erp-kpi-card p-5">
              <h3 className="text-sm font-semibold">Email tracking</h3>
              <ul className="mt-3 space-y-2 text-xs">
                {quote.emailLogs.map((e) => (
                  <li key={e.id}>
                    {e.toEmail} · {formatDate(e.sentAt)} · {e.status}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {quote.signatureStatus === "SIGNED" && (
            <div className="erp-kpi-card border-emerald-500/30 bg-emerald-500/5 p-5">
              <h3 className="text-sm font-semibold text-emerald-700">E-signature</h3>
              <p className="mt-1 text-sm">Signed by {quote.signatureName}</p>
              {quote.signedAt && (
                <p className="text-xs text-muted-foreground">{formatDate(quote.signedAt)}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
