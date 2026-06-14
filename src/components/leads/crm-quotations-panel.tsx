"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { convertQuotationToSalesOrder } from "@/actions/quotations";
import { isQuoteConvertible } from "@/lib/quotation-types";
import { formatInr } from "@/lib/utils";
import { toast } from "sonner";

export function CrmQuotationsPanel({
  quotations,
}: {
  quotations: {
    id: string;
    quoteNumber: string;
    total: unknown;
    status: string;
    convertedOrderId: string | null;
  }[];
}) {
  const router = useRouter();

  if (quotations.length === 0) return null;

  return (
    <div className="erp-kpi-card p-5">
      <h3 className="text-sm font-semibold">Quotations</h3>
      <ul className="mt-3 space-y-2">
        {quotations.map((q) => (
          <li key={q.id} className="rounded-lg border border-border/50 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/quotations/${q.id}`} className="font-medium hover:text-[#B68D40]">
                {q.quoteNumber}
              </Link>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{q.status}</span>
            </div>
            <p className="text-xs text-muted-foreground">{formatInr(Number(q.total))}</p>
            {isQuoteConvertible(q.status as import("@prisma/client").QuotationStatus) ? (
              <Button
                type="button"
                size="sm"
                variant="premium"
                className="mt-2 h-7 w-full text-xs"
                onClick={async () => {
                  try {
                    const result = await convertQuotationToSalesOrder(q.id);
                    toast.success(`Converted to ${result.orderNumber}`);
                    router.push(`/sales/orders`);
                    router.refresh();
                  } catch {
                    toast.error("Conversion failed");
                  }
                }}
              >
                <ArrowRightCircle className="mr-1 h-3.5 w-3.5" />
                Convert to sales order
              </Button>
            ) : q.convertedOrderId ? (
              <Button type="button" size="sm" variant="secondary" className="mt-2 h-7 w-full text-xs" asChild>
                <Link href="/sales/orders">View order</Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
