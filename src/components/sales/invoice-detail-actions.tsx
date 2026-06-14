"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InvoiceStatus, PaymentMethod } from "@prisma/client";
import { Download, Mail, MessageCircle, PenLine, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createCreditNote,
  recordInvoicePayment,
  reconcilePayment,
  sendInvoice,
  updateGstCompliance,
  updateInvoiceStatus,
} from "@/actions/sales";
import { INVOICE_STATUS_LABELS } from "@/lib/invoice-types";
import type { InvoiceLineItem } from "@/lib/invoice-types";
import { formatInr } from "@/lib/utils";
import { toast } from "sonner";

export function InvoiceDetailActions({
  invoice,
  payments,
}: {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    total: number;
    paidAmount: number;
    balance: number;
    customerId: string;
    customerEmail: string | null;
    customerPhone: string;
    eInvoiceIrn: string | null;
    eWayBillNumber: string | null;
    items: { productId: string; quantity: number }[];
  };
  payments: {
    id: string;
    amount: number;
    paymentMode: string | null;
    utr: string | null;
    reference: string | null;
    reconciled: boolean;
    paidAt: string;
  }[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(invoice.balance));
  const [utr, setUtr] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMethod>("BANK_TRANSFER");
  const [email, setEmail] = useState(invoice.customerEmail ?? "");
  const [irn, setIrn] = useState(invoice.eInvoiceIrn ?? "");
  const [eway, setEway] = useState(invoice.eWayBillNumber ?? "");
  const [cnReason, setCnReason] = useState("");

  return (
    <div className="erp-kpi-card space-y-4 p-5">
      <h3 className="text-sm font-semibold">Actions</h3>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" asChild>
          <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
            <Download className="mr-1 h-4 w-4" />
            PDF
          </a>
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={`/customers/${invoice.customerId}?tab=ledger`}>Ledger</a>
        </Button>
      </div>

      <div>
        <label className="text-xs font-semibold">Update status</label>
        <select
          defaultValue={invoice.status}
          onChange={async (e) => {
            await updateInvoiceStatus(invoice.id, e.target.value as InvoiceStatus);
            toast.success("Status updated");
            router.refresh();
          }}
          className="mt-1 flex h-9 w-full rounded-lg border border-border px-2 text-sm"
        >
          {Object.keys(INVOICE_STATUS_LABELS).map((s) => (
            <option key={s} value={s}>
              {INVOICE_STATUS_LABELS[s as InvoiceStatus]}
            </option>
          ))}
        </select>
      </div>

      {invoice.balance > 0 && (
        <div className="rounded-lg border border-border/50 p-3">
          <p className="text-xs font-semibold">Record payment</p>
          <p className="text-[10px] text-muted-foreground">Balance: {formatInr(invoice.balance)}</p>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-2 flex h-9 w-full rounded-lg border border-border px-3 text-sm"
          />
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMethod)}
            className="mt-2 flex h-9 w-full rounded-lg border border-border px-2 text-sm"
          >
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="UPI">UPI</option>
            <option value="NEFT">NEFT</option>
            <option value="RTGS">RTGS</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
          </select>
          <input
            placeholder="UTR / reference"
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            className="mt-2 flex h-9 w-full rounded-lg border border-border px-3 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="premium"
            className="mt-2 w-full"
            onClick={async () => {
              try {
                await recordInvoicePayment(invoice.id, {
                  amount: Number(amount),
                  paymentMode,
                  utr: utr || undefined,
                });
                toast.success("Payment recorded");
                router.refresh();
              } catch {
                toast.error("Payment failed");
              }
            }}
          >
            Record payment
          </Button>
        </div>
      )}

      {payments.length > 0 && (
        <div>
          <p className="text-xs font-semibold">Payments</p>
          <ul className="mt-2 space-y-2 text-xs">
            {payments.map((p) => (
              <li key={p.id} className="rounded-lg border border-border/50 px-3 py-2">
                <span className="font-semibold">{formatInr(p.amount)}</span>
                <span className="ml-2 text-muted-foreground">{p.paymentMode ?? "—"}</span>
                {p.utr && <p className="font-mono text-[10px]">UTR: {p.utr}</p>}
                <label className="mt-1 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={p.reconciled}
                    onChange={async (e) => {
                      await reconcilePayment(p.id, e.target.checked);
                      router.refresh();
                    }}
                  />
                  Reconciled
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <label className="text-xs font-semibold">Payment reminder</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="mt-1 flex h-9 w-full rounded-lg border border-border px-3 text-sm"
        />
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={async () => {
              if (!email) return;
              const r = await sendInvoice(invoice.id, "email", email);
              if (r.href) window.open(r.href, "_blank");
              toast.success("Email reminder logged");
            }}
          >
            <Mail className="mr-1 h-3.5 w-3.5" />
            Email
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={async () => {
              const r = await sendInvoice(invoice.id, "whatsapp", invoice.customerPhone);
              if (r.href) window.open(r.href, "_blank");
              toast.success("WhatsApp reminder logged");
            }}
          >
            <MessageCircle className="mr-1 h-3.5 w-3.5" />
            WhatsApp
          </Button>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold">GST compliance</label>
        <input
          placeholder="e-Invoice IRN"
          value={irn}
          onChange={(e) => setIrn(e.target.value)}
          className="mt-1 flex h-9 w-full rounded-lg border border-border px-3 text-sm"
        />
        <input
          placeholder="e-Way bill number"
          value={eway}
          onChange={(e) => setEway(e.target.value)}
          className="mt-1 flex h-9 w-full rounded-lg border border-border px-3 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          onClick={async () => {
            await updateGstCompliance(invoice.id, { eInvoiceIrn: irn, eWayBillNumber: eway });
            toast.success("GST fields saved");
            router.refresh();
          }}
        >
          <PenLine className="mr-1 h-4 w-4" />
          Save GST refs
        </Button>
      </div>

      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
        <p className="text-xs font-semibold text-red-700">Credit note / return</p>
        <input
          placeholder="Reason for credit"
          value={cnReason}
          onChange={(e) => setCnReason(e.target.value)}
          className="mt-1 flex h-9 w-full rounded-lg border border-border px-3 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          onClick={async () => {
            if (!cnReason.trim()) return;
            try {
              await createCreditNote(invoice.id, {
                reason: cnReason,
                lines: invoice.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
              });
              toast.success("Credit note issued");
              router.refresh();
            } catch {
              toast.error("Could not create credit note");
            }
          }}
        >
          Issue full credit note
        </Button>
      </div>

      <Button type="button" size="sm" variant="secondary" className="w-full" asChild>
        <a href="/sales/orders">
          <Truck className="mr-1 h-4 w-4" />
          View dispatch / orders
        </a>
      </Button>
    </div>
  );
}

export function InvoiceLineItemsTable({ items }: { items: InvoiceLineItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-sm">
        <thead className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-2">SKU / Product</th>
            <th className="py-2">HSN</th>
            <th className="py-2">Batch</th>
            <th className="py-2">Qty</th>
            <th className="py-2">Rate</th>
            <th className="py-2">Disc.</th>
            <th className="py-2">CGST</th>
            <th className="py-2">SGST</th>
            <th className="py-2">IGST</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {items.map((line, i) => (
            <tr key={`${line.productId}-${i}`}>
              <td className="py-2">
                <span className="font-medium">{line.productName}</span>
                {line.sku && <p className="font-mono text-[10px] text-muted-foreground">{line.sku}</p>}
              </td>
              <td className="py-2 font-mono text-xs">{line.hsnCode ?? "—"}</td>
              <td className="py-2 text-xs">
                {line.batchNumber ?? "—"}
                {line.expiryDate && <p className="text-muted-foreground">Exp: {line.expiryDate}</p>}
              </td>
              <td className="py-2">{line.quantity}</td>
              <td className="py-2">{formatInr(line.unitPrice)}</td>
              <td className="py-2">{line.discountAmount ? formatInr(line.discountAmount) : "—"}</td>
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
