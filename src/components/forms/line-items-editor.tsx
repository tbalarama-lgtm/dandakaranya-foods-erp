"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatInr } from "@/lib/utils";
import type { ClientProduct } from "@/lib/serialize-prisma";

export type LineRow = {
  key: string;
  productId: string;
  quantity: number;
  unitPrice: number;
};

type PriceMode = "sale" | "cost";

function defaultPrice(p: ClientProduct, mode: PriceMode) {
  return mode === "sale" ? Number(p.salePrice) : Number(p.costPrice) || Number(p.salePrice);
}

function newRow(products: ClientProduct[], mode: PriceMode): LineRow {
  const p = products[0];
  return {
    key: crypto.randomUUID(),
    productId: p?.id ?? "",
    quantity: 1,
    unitPrice: p ? defaultPrice(p, mode) : 0,
  };
}

export function LineItemsEditor({
  products,
  priceMode,
  lines,
  onChange,
}: {
  products: ClientProduct[];
  priceMode: PriceMode;
  lines: LineRow[];
  onChange: (lines: LineRow[]) => void;
}) {
  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let gst = 0;
    for (const row of lines) {
      const p = productMap[row.productId];
      if (!p) continue;
      const lineSub = row.unitPrice * row.quantity;
      const gstPct = Number(p.gstPercent);
      subtotal += lineSub;
      gst += (lineSub * gstPct) / 100;
    }
    return { subtotal, gst, total: subtotal + gst };
  }, [lines, productMap]);

  if (products.length === 0) {
    return <p className="text-sm text-muted-foreground">Add products to the catalogue first.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Line items</Label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...lines, newRow(products, priceMode)])}
        >
          <Plus className="h-4 w-4" />
          Add line
        </Button>
      </div>

      <div className="space-y-3">
        {lines.map((row, index) => (
          <div
            key={row.key}
            className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-[1fr_100px_120px_40px]"
          >
            <div>
              <Label className="text-xs">Product</Label>
              <select
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
                value={row.productId}
                onChange={(e) => {
                  const p = productMap[e.target.value];
                  const next = [...lines];
                  next[index] = {
                    ...row,
                    productId: e.target.value,
                    unitPrice: p ? defaultPrice(p, priceMode) : 0,
                  };
                  onChange(next);
                }}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Qty</Label>
              <input
                type="number"
                min={0.001}
                step="any"
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
                value={row.quantity}
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = { ...row, quantity: Number(e.target.value) || 0 };
                  onChange(next);
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Unit price (₹)</Label>
              <input
                type="number"
                min={0}
                step="any"
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
                value={row.unitPrice}
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = { ...row, unitPrice: Number(e.target.value) || 0 };
                  onChange(next);
                }}
              />
            </div>
            <div className="flex items-end justify-center pb-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={lines.length <= 1}
                onClick={() => onChange(lines.filter((l) => l.key !== row.key))}
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatInr(totals.subtotal)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted-foreground">GST</span>
          <span>{formatInr(totals.gst)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
          <span>Total</span>
          <span>{formatInr(totals.total)}</span>
        </div>
      </div>
    </div>
  );
}

export function useLineItemsState(products: ClientProduct[], priceMode: PriceMode) {
  return useState<LineRow[]>(() => [newRow(products, priceMode)]);
}
