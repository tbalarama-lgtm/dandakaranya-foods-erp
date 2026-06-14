"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QuotationTaxMode } from "@prisma/client";
import { createInvoice } from "@/actions/sales";
import { LineItemsEditor, useLineItemsState } from "@/components/forms/line-items-editor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { INVOICE_TAX_MODE_LABELS, INVOICE_TEMPLATES } from "@/lib/invoice-types";
import type { Customer } from "@prisma/client";
import type { ClientProduct } from "@/lib/serialize-prisma";
import { toast } from "sonner";

export function InvoiceForm({
  customers,
  products,
  warehouses,
  defaultCustomerId,
}: {
  customers: Customer[];
  products: ClientProduct[];
  warehouses: { id: string; name: string }[];
  defaultCustomerId?: string;
}) {
  const router = useRouter();
  const [lines, setLines] = useLineItemsState(products, "sale");
  const [taxMode, setTaxMode] = useState<QuotationTaxMode>("DOMESTIC");
  const [loading, setLoading] = useState(false);

  return (
    <div className="erp-kpi-card max-w-4xl p-6">
      <form
        className="space-y-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          const fd = new FormData(e.currentTarget);
          try {
            const inv = await createInvoice({
              customerId: String(fd.get("customerId")),
              lines: lines.map((l) => ({
                productId: l.productId,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                discountPercent: Number(fd.get("discountPercent") || 0) || undefined,
                batchNumber: String(fd.get(`batch-${l.productId}`) || "") || undefined,
                expiryDate: String(fd.get(`expiry-${l.productId}`) || "") || undefined,
              })),
              notes: String(fd.get("notes") || ""),
              internalNotes: String(fd.get("internalNotes") || ""),
              taxMode,
              currency: String(fd.get("currency") || "INR"),
              shippingAmount: Number(fd.get("shippingAmount") || 0) || undefined,
              discountAmount: Number(fd.get("quoteDiscount") || 0) || undefined,
              dueDays: Number(fd.get("dueDays") || 30),
              warehouseId: String(fd.get("warehouseId") || "") || undefined,
              templateKey: String(fd.get("templateKey") || "standard"),
              incoterms: String(fd.get("incoterms") || ""),
              customsReference: String(fd.get("customsReference") || ""),
              shippingDocRef: String(fd.get("shippingDocRef") || ""),
              eInvoiceIrn: String(fd.get("eInvoiceIrn") || ""),
              eWayBillNumber: String(fd.get("eWayBillNumber") || ""),
              deductStock: fd.get("deductStock") === "on",
              status: fd.get("postNow") === "on" ? "SENT" : "DRAFT",
            });
            toast.success(`Invoice ${inv.invoiceNumber} created`);
            router.push(`/sales/${inv.id}`);
            router.refresh();
          } catch {
            toast.error("Could not create invoice");
          } finally {
            setLoading(false);
          }
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Customer" name="customerId" required defaultValue={defaultCustomerId ?? ""}>
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.company ? ` (${c.company})` : ""}
              </option>
            ))}
          </SelectField>
          <SelectField label="Warehouse" name="warehouseId" defaultValue="">
            <option value="">Default</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Template" name="templateKey" defaultValue="standard">
            {INVOICE_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </SelectField>
          <div>
            <Label>Tax mode</Label>
            <select
              value={taxMode}
              onChange={(e) => setTaxMode(e.target.value as QuotationTaxMode)}
              className="mt-1.5 flex h-10 w-full rounded-lg border border-border px-3 text-sm"
            >
              {Object.entries(INVOICE_TAX_MODE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <SelectField label="Currency" name="currency" defaultValue="INR">
            <option value="INR">INR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="AED">AED</option>
          </SelectField>
          <SelectField label="Payment terms (days)" name="dueDays" defaultValue="30">
            <option value="15">15 days</option>
            <option value="30">30 days</option>
            <option value="45">45 days</option>
            <option value="60">60 days</option>
          </SelectField>
        </div>

        <LineItemsEditor products={products} priceMode="sale" lines={lines} onChange={setLines} />

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="discountPercent">Line discount %</Label>
            <input id="discountPercent" name="discountPercent" type="number" min={0} max={100} className="mt-1.5 flex h-10 w-full rounded-lg border border-border px-3 text-sm" />
          </div>
          <div>
            <Label htmlFor="quoteDiscount">Invoice discount (₹)</Label>
            <input id="quoteDiscount" name="quoteDiscount" type="number" min={0} className="mt-1.5 flex h-10 w-full rounded-lg border border-border px-3 text-sm" />
          </div>
          <div>
            <Label htmlFor="shippingAmount">Freight (₹)</Label>
            <input id="shippingAmount" name="shippingAmount" type="number" min={0} className="mt-1.5 flex h-10 w-full rounded-lg border border-border px-3 text-sm" />
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <h3 className="text-sm font-semibold">Export & GST compliance</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input name="incoterms" placeholder="Incoterms" className="h-10 rounded-lg border border-border px-3 text-sm" />
            <input name="customsReference" placeholder="Customs reference" className="h-10 rounded-lg border border-border px-3 text-sm" />
            <input name="shippingDocRef" placeholder="Shipping documents ref." className="h-10 rounded-lg border border-border px-3 text-sm" />
            <input name="eInvoiceIrn" placeholder="e-Invoice IRN" className="h-10 rounded-lg border border-border px-3 text-sm" />
            <input name="eWayBillNumber" placeholder="e-Way bill number" className="h-10 rounded-lg border border-border px-3 text-sm" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="notes">Customer notes</Label>
            <Textarea id="notes" name="notes" rows={2} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="internalNotes">Internal notes</Label>
            <Textarea id="internalNotes" name="internalNotes" rows={2} className="mt-1.5" />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="deductStock" defaultChecked />
            Deduct inventory on save
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="postNow" />
            Mark as sent (skip draft)
          </label>
        </div>

        <Button type="submit" variant="premium" disabled={loading || lines.length === 0}>
          {loading ? "Creating…" : "Create invoice"}
        </Button>
      </form>
    </div>
  );
}
