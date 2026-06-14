"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Circle, FileText, Receipt, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { convertOrderToInvoice } from "@/actions/sales";
import { convertQuotationToSalesOrder } from "@/actions/quotations";
import { isQuoteConvertible } from "@/lib/quotation-types";
import { formatInr } from "@/lib/utils";
import { toast } from "sonner";

type ChainData = {
  quotations: {
    id: string;
    quoteNumber: string;
    status: string;
    total: unknown;
    convertedOrderId: string | null;
  }[];
  orders: {
    id: string;
    orderNumber: string;
    status: string;
    total: unknown;
    invoice: { id: string; invoiceNumber: string; status: string; paymentStatus: string } | null;
  }[];
};

export function CrmConversionChain({ chain }: { chain: ChainData }) {
  const router = useRouter();
  const latestQuote = chain.quotations[0];
  const latestOrder = chain.orders[0];
  const invoice = latestOrder?.invoice;

  const steps = [
    { key: "lead", label: "Lead", done: true, icon: Circle },
    { key: "quote", label: "Quotation", done: Boolean(latestQuote), icon: FileText },
    { key: "order", label: "Sales order", done: Boolean(latestOrder), icon: ShoppingCart },
    { key: "invoice", label: "Invoice", done: Boolean(invoice), icon: Receipt },
  ];

  if (!latestQuote && !latestOrder) return null;

  return (
    <div className="erp-kpi-card p-5">
      <h3 className="text-sm font-semibold">Conversion workflow</h3>
      <p className="mt-1 text-xs text-muted-foreground">Lead → Quotation → Sales Order → Invoice</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                step.done ? "bg-emerald-500/12 text-emerald-700" : "bg-muted text-muted-foreground"
              }`}
            >
              {step.done ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <step.icon className="h-3.5 w-3.5" />
              )}
              {step.label}
            </div>
            {i < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2 text-sm">
        {latestQuote && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2">
            <div>
              <span className="font-medium">{latestQuote.quoteNumber}</span>
              <span className="ml-2 text-xs text-muted-foreground">{latestQuote.status}</span>
              <p className="text-xs text-muted-foreground">{formatInr(Number(latestQuote.total))}</p>
            </div>
            {!latestQuote.convertedOrderId && isQuoteConvertible(latestQuote.status as import("@prisma/client").QuotationStatus) && (
              <Button
                type="button"
                size="sm"
                variant="premium"
                className="h-7 text-xs"
                onClick={async () => {
                  try {
                    const r = await convertQuotationToSalesOrder(latestQuote.id);
                    toast.success(`Order ${r.orderNumber} created`);
                    router.refresh();
                  } catch {
                    toast.error("Conversion failed");
                  }
                }}
              >
                → Order
              </Button>
            )}
          </div>
        )}

        {latestOrder && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2">
            <div>
              <Link href="/sales/orders" className="font-medium hover:text-[#B68D40]">
                {latestOrder.orderNumber}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">{latestOrder.status}</span>
              <p className="text-xs text-muted-foreground">{formatInr(Number(latestOrder.total))}</p>
            </div>
            {!invoice && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                onClick={async () => {
                  try {
                    const r = await convertOrderToInvoice(latestOrder.id);
                    toast.success(`Invoice ${r.invoiceNumber} created`);
                    router.refresh();
                  } catch {
                    toast.error("Invoice creation failed");
                  }
                }}
              >
                → Invoice
              </Button>
            )}
          </div>
        )}

        {invoice && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
            <Link href={`/sales/${invoice.id}`} className="font-medium text-emerald-700 hover:underline">
              {invoice.invoiceNumber}
            </Link>
            <span className="ml-2 text-xs text-muted-foreground">{invoice.status}</span>
          </div>
        )}
      </div>
    </div>
  );
}
