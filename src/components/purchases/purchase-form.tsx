"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPurchase } from "@/actions/purchases";
import { AddVendorDialog } from "@/components/vendors/add-vendor-dialog";
import { LineItemsEditor, useLineItemsState } from "@/components/forms/line-items-editor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import type { Vendor } from "@prisma/client";
import type { ClientProduct } from "@/lib/serialize-prisma";

export function PurchaseForm({
  vendors,
  products,
  canAddVendor = false,
}: {
  vendors: Vendor[];
  products: ClientProduct[];
  canAddVendor?: boolean;
}) {
  const router = useRouter();
  const [lines, setLines] = useLineItemsState(products, "cost");

  return (
    <Card className="max-w-3xl">
      <CardContent className="pt-6">
        <form
          className="space-y-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (vendors.length === 0) {
              toast.error("Add a vendor first");
              return;
            }
            try {
              await createPurchase({
                vendorId: String(fd.get("vendorId")),
                notes: String(fd.get("notes") || ""),
                lines: lines.map((l) => ({
                  productId: l.productId,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                })),
              });
              toast.success("Draft PO created");
              router.push("/purchases");
            } catch {
              toast.error("Could not create purchase");
            }
          }}
        >
          <SelectField label="Vendor" name="vendorId" required>
            <option value="">Select vendor</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </SelectField>

          {vendors.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm">
              <p className="font-medium text-foreground">No vendors yet</p>
              <p className="mt-1 text-muted-foreground">
                Add a supplier before recording a purchase.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {canAddVendor ? (
                  <AddVendorDialog size="sm" />
                ) : (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/vendors">Open vendors</Link>
                  </Button>
                )}
              </div>
            </div>
          )}

          <LineItemsEditor products={products} priceMode="cost" lines={lines} onChange={setLines} />

          <div>
            <Label htmlFor="po-notes">Notes (optional)</Label>
            <Textarea id="po-notes" name="notes" className="mt-1.5" rows={2} placeholder="Bill reference, delivery note…" />
          </div>

          <Button type="submit" disabled={products.length === 0}>
            Record purchase
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
