"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { convertOrderToInvoice } from "@/actions/sales";
import { toast } from "sonner";

export function OrderRowActions({
  orderId,
  orderNumber,
  hasInvoice,
  invoiceId,
}: {
  orderId: string;
  orderNumber: string;
  hasInvoice: boolean;
  invoiceId: string | null;
}) {
  const router = useRouter();

  if (hasInvoice && invoiceId) {
    return (
      <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" asChild>
        <Link href={`/sales/${invoiceId}`}>
          <FileText className="mr-1 h-3.5 w-3.5" />
          View invoice
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="premium"
      className="h-7 text-xs"
      onClick={async () => {
        try {
          const r = await convertOrderToInvoice(orderId);
          toast.success(`Invoice ${r.invoiceNumber} created`);
          router.push(`/sales/${r.invoiceId}`);
          router.refresh();
        } catch {
          toast.error("Could not create invoice");
        }
      }}
    >
      <ArrowRightCircle className="mr-1 h-3.5 w-3.5" />
      → Invoice
    </Button>
  );
}
