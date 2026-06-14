"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TamarindGrade } from "@prisma/client";
import { createRfq } from "@/actions/rfq";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TAMARIND_GRADE_LABELS } from "@/lib/vendor-types";
import { toast } from "sonner";

export function RfqCreateForm({ vendors }: { vendors: { id: string; name: string; isFpoPartner: boolean }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);

  const toggleVendor = (id: string) => {
    setSelectedVendors((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createRfq({
        title: String(fd.get("title") ?? ""),
        productName: String(fd.get("productName") ?? "") || undefined,
        quantity: fd.get("quantity") ? Number(fd.get("quantity")) : undefined,
        unit: String(fd.get("unit") ?? "kg"),
        dueDate: String(fd.get("dueDate") ?? "") || undefined,
        notes: String(fd.get("notes") ?? "") || undefined,
        budgetAmount: fd.get("budgetAmount") ? Number(fd.get("budgetAmount")) : undefined,
        baselinePrice: fd.get("baselinePrice") ? Number(fd.get("baselinePrice")) : undefined,
        specTamarindGrade: (fd.get("specTamarindGrade") as TamarindGrade) || undefined,
        specMoistureMaxPct: fd.get("specMoistureMaxPct") ? Number(fd.get("specMoistureMaxPct")) : undefined,
        specPulpYieldMinPct: fd.get("specPulpYieldMinPct") ? Number(fd.get("specPulpYieldMinPct")) : undefined,
        specAcidityMin: fd.get("specAcidityMin") ? Number(fd.get("specAcidityMin")) : undefined,
        packagingRequirements: String(fd.get("packagingRequirements") ?? "") || undefined,
        moqRequired: fd.get("moqRequired") ? Number(fd.get("moqRequired")) : undefined,
        sourcingType: (fd.get("sourcingType") as "COMMERCIAL" | "FPO" | "FARMER_DIRECT" | "MIXED") || undefined,
        auctionMode: (fd.get("auctionMode") as "STANDARD" | "REVERSE_AUCTION") || undefined,
        seasonalWindow: String(fd.get("seasonalWindow") ?? "") || undefined,
        vendorIds: selectedVendors.length ? selectedVendors : undefined,
      });
      if (result.ok && result.data?.id) {
        toast.success("RFQ created");
        router.push(`/procurement/rfq/${result.data.id}`);
      } else if (!result.ok) {
        toast.error(result.error ?? "Failed to create RFQ");
      } else {
        toast.error("Failed to create RFQ");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="erp-kpi-card max-w-3xl space-y-5 p-6">
      <div>
        <Label htmlFor="title">RFQ title *</Label>
        <input id="title" name="title" required className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="productName">Product</Label>
          <input id="productName" name="productName" className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm" placeholder="Raw Tamarind" />
        </div>
        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <input id="quantity" name="quantity" type="number" step="0.001" className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm" />
        </div>
        <div>
          <Label htmlFor="unit">Unit</Label>
          <input id="unit" name="unit" defaultValue="kg" className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm" />
        </div>
        <div>
          <Label htmlFor="dueDate">Quote due date</Label>
          <input id="dueDate" name="dueDate" type="date" className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm" />
        </div>
        <div>
          <Label htmlFor="budgetAmount">Budget (INR)</Label>
          <input id="budgetAmount" name="budgetAmount" type="number" className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm" />
        </div>
        <div>
          <Label htmlFor="baselinePrice">Baseline price / unit</Label>
          <input id="baselinePrice" name="baselinePrice" type="number" className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm" />
        </div>
        <div>
          <Label htmlFor="sourcingType">Sourcing type</Label>
          <select id="sourcingType" name="sourcingType" className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm">
            <option value="COMMERCIAL">Commercial</option>
            <option value="FPO">FPO / cooperative</option>
            <option value="FARMER_DIRECT">Farmer direct</option>
            <option value="MIXED">Mixed</option>
          </select>
        </div>
        <div>
          <Label htmlFor="auctionMode">Bidding mode</Label>
          <select id="auctionMode" name="auctionMode" className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm">
            <option value="STANDARD">Standard RFQ</option>
            <option value="REVERSE_AUCTION">Reverse auction</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <p className="text-sm font-semibold">Food specifications</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="specTamarindGrade">Tamarind grade</Label>
            <select id="specTamarindGrade" name="specTamarindGrade" className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm">
              <option value="">—</option>
              {Object.entries(TAMARIND_GRADE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="specMoistureMaxPct">Moisture max %</Label>
            <input id="specMoistureMaxPct" name="specMoistureMaxPct" type="number" step="0.1" defaultValue={12} className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm" />
          </div>
          <div>
            <Label htmlFor="specPulpYieldMinPct">Pulp yield min %</Label>
            <input id="specPulpYieldMinPct" name="specPulpYieldMinPct" type="number" step="0.1" defaultValue={38} className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm" />
          </div>
          <div>
            <Label htmlFor="specAcidityMin">Acidity min %</Label>
            <input id="specAcidityMin" name="specAcidityMin" type="number" step="0.1" className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="packagingRequirements">Packaging requirements</Label>
            <input id="packagingRequirements" name="packagingRequirements" className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm" placeholder="Food-grade HDPE, 25kg bags" />
          </div>
        </div>
      </div>

      <div>
        <Label>Invite vendors</Label>
        <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-border p-2">
          {vendors.map((v) => (
            <label key={v.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
              <input type="checkbox" checked={selectedVendors.includes(v.id)} onChange={() => toggleVendor(v.id)} />
              {v.name}
              {v.isFpoPartner && <span className="text-[10px] text-emerald-700">FPO</span>}
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <textarea id="notes" name="notes" rows={3} className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm" />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create RFQ (Draft)"}
      </Button>
    </form>
  );
}
