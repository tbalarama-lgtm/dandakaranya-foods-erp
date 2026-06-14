"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { createProduct, updateProduct } from "@/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Product, ProductCategory } from "@prisma/client";

type ProductWithCat = Product & { category: ProductCategory | null };

const LABELS: Record<string, string> = {
  sku: "SKU",
  name: "Product name",
  barcode: "Barcode",
  unit: "Unit",
  costPrice: "Cost price (₹)",
  salePrice: "Sale price (₹)",
  gstPercent: "GST %",
  minStockQty: "Min stock alert",
  stockQty: "Opening stock",
};

export function ProductFormDialog({
  categories,
  product,
}: {
  categories: ProductCategory[];
  product?: ProductWithCat;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(product);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm">
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4" />
            Add product
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>SKU, pricing, GST, and stock settings.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const fd = new FormData(e.currentTarget);
            const payload = {
              sku: String(fd.get("sku")),
              name: String(fd.get("name")),
              barcode: String(fd.get("barcode") || ""),
              categoryId: String(fd.get("categoryId") || "") || undefined,
              unit: String(fd.get("unit") || "kg"),
              costPrice: Number(fd.get("costPrice")),
              salePrice: Number(fd.get("salePrice")),
              gstPercent: Number(fd.get("gstPercent")),
              minStockQty: Number(fd.get("minStockQty")),
              stockQty: isEdit ? undefined : Number(fd.get("stockQty") || 0),
              active: fd.get("active") === "on",
            };
            try {
              if (isEdit && product) {
                await updateProduct(product.id, payload);
                toast.success("Product updated");
              } else {
                await createProduct(payload);
                toast.success("Product created");
              }
              setOpen(false);
              router.refresh();
            } catch {
              toast.error(isEdit ? "Update failed" : "Create failed");
            } finally {
              setLoading(false);
            }
          }}
        >
          {(["sku", "name", "barcode", "unit"] as const).map((key) => (
            <div key={key}>
              <Label htmlFor={`p-${key}`}>{LABELS[key]}</Label>
              <Input
                id={`p-${key}`}
                name={key}
                required={key === "sku" || key === "name"}
                defaultValue={product?.[key] != null ? String(product[key]) : undefined}
                className="mt-1.5"
                readOnly={isEdit && key === "sku"}
              />
            </div>
          ))}
          <SelectField label="Category" name="categoryId" defaultValue={product?.categoryId ?? ""}>
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          {(["costPrice", "salePrice", "gstPercent", "minStockQty"] as const).map((key) => (
            <div key={key}>
              <Label htmlFor={`p-${key}`}>{LABELS[key]}</Label>
              <Input
                id={`p-${key}`}
                name={key}
                type="number"
                step="any"
                min={0}
                required
                defaultValue={product ? String(product[key]) : key === "gstPercent" ? "5" : "0"}
                className="mt-1.5"
              />
            </div>
          ))}
          {!isEdit && (
            <div>
              <Label htmlFor="p-stockQty">{LABELS.stockQty}</Label>
              <Input id="p-stockQty" name="stockQty" type="number" step="any" min={0} defaultValue={0} className="mt-1.5" />
            </div>
          )}
          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={product?.active} />
              Active in catalogue
            </label>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
