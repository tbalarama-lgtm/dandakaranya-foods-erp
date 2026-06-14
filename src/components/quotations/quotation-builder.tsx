"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QuotationTaxMode } from "@prisma/client";
import { createQuotation } from "@/actions/quotations";
import { LineItemsEditor, useLineItemsState } from "@/components/forms/line-items-editor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { QUOTE_TEMPLATES, QUOTE_TAX_MODE_LABELS } from "@/lib/quotation-types";
import type { ClientProduct } from "@/lib/serialize-prisma";
import { toast } from "sonner";

export function QuotationBuilder({
  customers,
  products,
  defaultCustomerId,
  defaultLeadId,
}: {
  customers: { id: string; name: string; company: string | null }[];
  products: ClientProduct[];
  defaultCustomerId?: string;
  defaultLeadId?: string;
}) {
  const router = useRouter();
  const [lines, setLines] = useLineItemsState(products, "sale");
  const [taxMode, setTaxMode] = useState<QuotationTaxMode>("DOMESTIC");
  const [loading, setLoading] = useState(false);

  return (
    <div className="erp-kpi-card p-6">
      <form
        className="space-y-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          const fd = new FormData(e.currentTarget);
          try {
            const quote = await createQuotation({
              customerId: String(fd.get("customerId") || "") || undefined,
              leadId: defaultLeadId,
              lines: lines.map((l) => ({
                productId: l.productId,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                discountPercent: Number(fd.get("discountPercent") || 0) || undefined,
              })),
              notes: String(fd.get("notes") || ""),
              internalNotes: String(fd.get("internalNotes") || ""),
              taxMode,
              currency: String(fd.get("currency") || "INR"),
              exchangeRate: Number(fd.get("exchangeRate") || 0) || undefined,
              shippingAmount: Number(fd.get("shippingAmount") || 0) || undefined,
              discountAmount: Number(fd.get("quoteDiscount") || 0) || undefined,
              validDays: Number(fd.get("validDays") || 30),
              incoterms: String(fd.get("incoterms") || ""),
              pricingTerms: String(fd.get("pricingTerms") || ""),
              moq: String(fd.get("moq") || ""),
              packagingConfig: String(fd.get("packagingConfig") || ""),
              containerQty: String(fd.get("containerQty") || ""),
              shelfLife: String(fd.get("shelfLife") || ""),
              templateKey: String(fd.get("templateKey") || "standard"),
            });
            toast.success(`Quotation ${quote.quoteNumber} created`);
            router.push(`/quotations/${quote.id}`);
            router.refresh();
          } catch {
            toast.error("Could not create quotation");
          } finally {
            setLoading(false);
          }
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {!defaultLeadId && (
            <SelectField label="Customer" name="customerId" defaultValue={defaultCustomerId ?? ""}>
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? ` (${c.company})` : ""}
                </option>
              ))}
            </SelectField>
          )}
          <SelectField label="Template" name="templateKey" defaultValue="standard">
            {QUOTE_TEMPLATES.map((t) => (
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
              {Object.entries(QUOTE_TAX_MODE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <SelectField label="Currency" name="currency" defaultValue="INR">
            <option value="INR">INR — Indian Rupee</option>
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="AED">AED — UAE Dirham</option>
            <option value="SGD">SGD — Singapore Dollar</option>
          </SelectField>
          <SelectField label="Validity (days)" name="validDays" defaultValue="30">
            <option value="15">15 days</option>
            <option value="30">30 days</option>
            <option value="45">45 days</option>
            <option value="60">60 days</option>
          </SelectField>
          <div>
            <Label htmlFor="exchangeRate">Exchange rate (optional)</Label>
            <input id="exchangeRate" name="exchangeRate" type="number" step="0.0001" className="mt-1.5 flex h-10 w-full rounded-lg border border-border px-3 text-sm" />
          </div>
        </div>

        <LineItemsEditor products={products} priceMode="sale" lines={lines} onChange={setLines} />

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="discountPercent">Line discount % (all lines)</Label>
            <input id="discountPercent" name="discountPercent" type="number" min={0} max={100} className="mt-1.5 flex h-10 w-full rounded-lg border border-border px-3 text-sm" />
          </div>
          <div>
            <Label htmlFor="quoteDiscount">Quote-level discount (₹)</Label>
            <input id="quoteDiscount" name="quoteDiscount" type="number" min={0} className="mt-1.5 flex h-10 w-full rounded-lg border border-border px-3 text-sm" />
          </div>
          <div>
            <Label htmlFor="shippingAmount">Shipping (₹)</Label>
            <input id="shippingAmount" name="shippingAmount" type="number" min={0} className="mt-1.5 flex h-10 w-full rounded-lg border border-border px-3 text-sm" />
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <h3 className="text-sm font-semibold">Export commercial terms</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input name="incoterms" placeholder="Incoterms (e.g. FOB Chennai)" className="h-10 rounded-lg border border-border px-3 text-sm" />
            <select name="pricingTerms" className="h-10 rounded-lg border border-border px-3 text-sm">
              <option value="">Pricing terms</option>
              <option value="FOB">FOB</option>
              <option value="CIF">CIF</option>
              <option value="EXW">EXW</option>
              <option value="DDP">DDP</option>
            </select>
            <input name="moq" placeholder="MOQ" className="h-10 rounded-lg border border-border px-3 text-sm" />
            <input name="packagingConfig" placeholder="Packaging configuration" className="h-10 rounded-lg border border-border px-3 text-sm" />
            <input name="containerQty" placeholder="Container quantity" className="h-10 rounded-lg border border-border px-3 text-sm" />
            <input name="shelfLife" placeholder="Shelf-life information" className="h-10 rounded-lg border border-border px-3 text-sm" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="notes">Customer-facing notes</Label>
            <Textarea id="notes" name="notes" rows={3} className="mt-1.5" placeholder="Payment terms, delivery timeline…" />
          </div>
          <div>
            <Label htmlFor="internalNotes">Internal notes</Label>
            <Textarea id="internalNotes" name="internalNotes" rows={3} className="mt-1.5" placeholder="Margin notes, negotiation history…" />
          </div>
        </div>

        <Button type="submit" variant="premium" disabled={loading || lines.length === 0}>
          {loading ? "Creating…" : "Create quotation"}
        </Button>
      </form>
    </div>
  );
}
