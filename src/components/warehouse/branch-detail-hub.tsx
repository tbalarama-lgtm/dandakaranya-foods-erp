"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, GitBranch, MapPin, Warehouse } from "lucide-react";
import type { BranchDetail } from "@/lib/warehouse-types";
import { FACILITY_KIND_LABELS, FACILITY_KIND_STYLES } from "@/lib/warehouse-types";
import { formatInr, cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";

export function BranchDetailHub({ detail }: { detail: BranchDetail }) {
  return (
    <div className="space-y-6">
      <Link href="/warehouses" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Warehouse network
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{detail.name}</h2>
          <p className="text-sm text-muted-foreground font-mono">{detail.code} · {detail.region ?? ([detail.city, detail.state].filter(Boolean).join(", ") || "—")}</p>
        </div>
        {detail.latitude != null && detail.longitude != null && (
          <a
            href={`https://www.google.com/maps?q=${detail.latitude},${detail.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs text-[#B68D40] hover:bg-muted"
          >
            <MapPin className="h-4 w-4" /> Open map
          </a>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Warehouse} label="Warehouses" value={String(detail.warehouseCount)} sub={`${detail.dcCount} DCs`} />
        <Kpi icon={Building2} label="Inventory" value={formatInr(detail.inventoryValue)} sub={`${detail.activeSkus} SKUs`} />
      </div>

      <section>
        <h3 className="mb-3 text-sm font-medium">Linked warehouses</h3>
        <div className="space-y-2">
          {detail.warehouses.map((w) => (
            <Link key={w.id} href={`/warehouses/${w.id}`} className="block rounded-xl border border-border/60 p-4 hover:border-[#B68D40]/40">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-medium">{w.name}</p>
                  <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", FACILITY_KIND_STYLES[w.facilityKind])}>{FACILITY_KIND_LABELS[w.facilityKind]}</span>
                </div>
                <p className="text-sm font-semibold">{formatInr(w.inventoryValue)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {detail.distributionCenters.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium">Distribution centers</h3>
          {detail.distributionCenters.map((d) => (
            <div key={d.id} className="mb-2 rounded-xl border border-border/60 p-4 text-sm">
              <p className="font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground">{d.code} · {d.warehouseCount} warehouses · Pallet cap {d.palletCapacity}</p>
            </div>
          ))}
        </section>
      )}

      {detail.regionalPlans.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium">Regional distribution planning</h3>
          {detail.regionalPlans.map((p) => (
            <div key={p.id} className="mb-2 flex justify-between rounded-lg border border-border/40 px-3 py-2 text-xs">
              <span>{p.region} · FY {p.planYear}</span>
              <span>{p.actualVolume}/{p.targetVolume} ({p.attainmentPct}%)</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof GitBranch; label: string; value: string; sub: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="erp-kpi-card rounded-xl border border-border/60 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold">{value}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
        </div>
        <Icon className="h-5 w-5 text-[#B68D40]" strokeWidth={ICON_STROKE} />
      </div>
    </motion.div>
  );
}
