"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightCircle,
  Download,
  Mail,
  PenLine,
  RefreshCw,
} from "lucide-react";
import type { QuotationLineItem } from "@/lib/quotation-types";
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_STYLES,
  isQuoteConvertible,
} from "@/lib/quotation-types";
import { Button } from "@/components/ui/button";
import {
  approveQuotationPricing,
  convertQuotationToSalesOrder,
  createQuotationRevision,
  sendQuotationEmail,
  signQuotation,
  updateQuotationStatus,
} from "@/actions/quotations";
import { formatInr, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { QuotationStatus } from "@prisma/client";

export function QuotationDetailActions({
  quote,
}: {
  quote: {
    id: string;
    quoteNumber: string;
    status: QuotationStatus;
    requiresApproval: boolean;
    customerEmail: string | null;
    signatureStatus: string;
  };
}) {
  const router = useRouter();
  const [email, setEmail] = useState(quote.customerEmail ?? "");
  const [signatureName, setSignatureName] = useState("");

  return (
    <div className="erp-kpi-card space-y-4 p-5">
      <h3 className="text-sm font-semibold">Actions</h3>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" asChild>
          <a href={`/api/quotations/${quote.id}/pdf`} target="_blank" rel="noreferrer">
            <Download className="mr-1 h-4 w-4" />
            PDF
          </a>
        </Button>
        {isQuoteConvertible(quote.status) && (
          <Button
            type="button"
            size="sm"
            variant="premium"
            onClick={async () => {
              try {
                const r = await convertQuotationToSalesOrder(quote.id);
                toast.success(`Order ${r.orderNumber} created`);
                router.push("/sales/orders");
                router.refresh();
              } catch {
                toast.error("Conversion failed");
              }
            }}
          >
            <ArrowRightCircle className="mr-1 h-4 w-4" />
            Convert to order
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            const rev = await createQuotationRevision(quote.id);
            toast.success(`Revision ${rev.quoteNumber} created`);
            router.push(`/quotations/${rev.id}`);
          }}
        >
          <RefreshCw className="mr-1 h-4 w-4" />
          New revision
        </Button>
      </div>

      {quote.requiresApproval && quote.status === "UNDER_REVIEW" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold text-amber-700">Pricing approval required</p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={async () => {
                await approveQuotationPricing(quote.id, true);
                toast.success("Approved");
                router.refresh();
              }}
            >
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                await approveQuotationPricing(quote.id, false);
                toast.error("Rejected");
                router.refresh();
              }}
            >
              Reject
            </Button>
          </div>
        </div>
      )}

      <div>
        <label className="text-xs font-semibold">Send via email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="customer@email.com"
          className="mt-1 flex h-9 w-full rounded-lg border border-border px-3 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2 w-full"
          onClick={async () => {
            if (!email) return;
            const r = await sendQuotationEmail(quote.id, email, `Quotation ${quote.quoteNumber}`);
            if (r.mailto) window.open(r.mailto, "_blank");
            toast.success("Email logged & quote marked sent");
            router.refresh();
          }}
        >
          <Mail className="mr-1 h-4 w-4" />
          Send quotation
        </Button>
      </div>

      {quote.signatureStatus !== "SIGNED" && (
        <div>
          <label className="text-xs font-semibold">E-signature acceptance</label>
          <input
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder="Authorised signatory name"
            className="mt-1 flex h-9 w-full rounded-lg border border-border px-3 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2 w-full"
            onClick={async () => {
              if (!signatureName.trim()) return;
              await signQuotation(quote.id, signatureName.trim());
              toast.success("Signature recorded");
              router.refresh();
            }}
          >
            <PenLine className="mr-1 h-4 w-4" />
            Record signature
          </Button>
        </div>
      )}

      <div>
        <label className="text-xs font-semibold">Update status</label>
        <select
          defaultValue={quote.status}
          onChange={async (e) => {
            await updateQuotationStatus(quote.id, e.target.value as QuotationStatus);
            toast.success("Status updated");
            router.refresh();
          }}
          className="mt-1 flex h-9 w-full rounded-lg border border-border px-2 text-sm"
        >
          {Object.keys(QUOTE_STATUS_LABELS).map((s) => (
            <option key={s} value={s}>
              {QUOTE_STATUS_LABELS[s as QuotationStatus]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function QuotationLineItemsTable({ items }: { items: QuotationLineItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-2">Product</th>
            <th className="py-2">HSN</th>
            <th className="py-2">Qty</th>
            <th className="py-2">Rate</th>
            <th className="py-2">CGST</th>
            <th className="py-2">SGST</th>
            <th className="py-2">IGST</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {items.map((line, i) => (
            <tr key={`${line.productId}-${i}`}>
              <td className="py-2 font-medium">{line.productName}</td>
              <td className="py-2 font-mono text-xs">{line.hsnCode ?? "—"}</td>
              <td className="py-2">{line.quantity}</td>
              <td className="py-2">{formatInr(line.unitPrice)}</td>
              <td className="py-2">{formatInr(line.cgstAmount)}</td>
              <td className="py-2">{formatInr(line.sgstAmount)}</td>
              <td className="py-2">{formatInr(line.igstAmount)}</td>
              <td className="py-2 text-right font-semibold">{formatInr(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase", QUOTE_STATUS_STYLES[status])}>
      {QUOTE_STATUS_LABELS[status]}
    </span>
  );
}
