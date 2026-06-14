"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Package,
  Search,
  ShieldAlert,
  Truck,
  Warehouse,
} from "lucide-react";
import type { InventoryItemClass } from "@prisma/client";
import type { InventoryHubBundle } from "@/lib/inventory-types";
import {
  INVENTORY_CLASS_LABELS,
  INVENTORY_CLASS_STYLES,
  MOVEMENT_TYPE_LABELS,
} from "@/lib/inventory-types";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function InventoryGovernanceHub({ bundle }: { bundle: InventoryHubBundle }) {
  const { rows, kpis, transfers, pickPack, recentMovements, classBreakdown, nearExpiry, recentAudit } = bundle;
  const [q, setQ] = useState("");
  const [cls, setCls] = useState<InventoryItemClass | "">("");

  const filtered = useMemo(() => {
    let list = [...rows];
    if (cls) list = list.filter((r) => r.inventoryClass === cls);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(
        (r) => r.name.toLowerCase().includes(s) || r.sku.toLowerCase().includes(s) || (r.warehouseName?.toLowerCase().includes(s) ?? false),
      );
    }
    return list;
  }, [rows, q, cls]);

  return (
    <div className="space-y-6">
      {(kpis.lowStock > 0 || kpis.nearExpiry > 0 || kpis.reorderAlerts > 0) && (
        <div className="space-y-2">
          {kpis.reorderAlerts > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
              {kpis.reorderAlerts} SKU(s) below reorder point — procurement triggers recommended.
            </div>
          )}
          {kpis.nearExpiry > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/8 px-4 py-3 text-sm">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {kpis.nearExpiry} batch(es) near expiry — FEFO dispatch required.
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Warehouse} label="Inventory value" value={formatInr(kpis.totalValue)} sub={`${kpis.skuCount} SKUs · ${formatInr(kpis.reservedQty)} reserved`} />
        <Kpi icon={AlertTriangle} label="Low / reorder" value={String(kpis.lowStock + kpis.reorderAlerts)} sub={`${kpis.deadStock} dead stock SKUs`} />
        <Kpi icon={Package} label="Near expiry" value={String(kpis.nearExpiry)} sub={`Quarantine ${kpis.quarantineQty} · Rejected ${kpis.rejectedQty}`} />
        <Kpi icon={Truck} label="Operations" value={String(kpis.openTransfers + kpis.pendingPickPack)} sub={`Yield avg ${kpis.avgYieldPct}% · FIFO/FEFO active`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Inventory by class">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={classBreakdown.map((c) => ({ name: c.label.slice(0, 10), value: c.value }))}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
              <Bar dataKey="value" fill="#B68D40" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Recent movements">
          <div className="max-h-[220px] space-y-2 overflow-y-auto text-xs">
            {recentMovements.length === 0 ? (
              <p className="text-muted-foreground">No movements recorded.</p>
            ) : (
              recentMovements.slice(0, 8).map((m) => (
                <div key={m.id} className="flex justify-between border-b border-border/40 pb-1">
                  <span>{MOVEMENT_TYPE_LABELS[m.type]}</span>
                  <span className="font-medium">{m.quantity} {m.unit}</span>
                </div>
              ))
            )}
          </div>
        </ChartCard>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCls("")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", !cls ? "bg-[#B68D40] text-white" : "bg-muted")}>All classes</button>
        {(["RAW_MATERIAL", "WIP", "FINISHED_GOODS", "PACKAGING", "QUARANTINE"] as InventoryItemClass[]).map((c) => (
          <button key={c} type="button" onClick={() => setCls(c)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", cls === c ? "bg-[#B68D40] text-white" : "bg-muted")}>
            {INVENTORY_CLASS_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" placeholder="Search SKU, product, warehouse…" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 w-full rounded-xl border pl-9 pr-3 text-sm" />
      </div>

      <div className="space-y-3">
        {filtered.map((r) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/inventory/${r.id}`} className="font-semibold text-[#B68D40] hover:underline">{r.name}</Link>
                  <span className="font-mono text-[10px] text-muted-foreground" spellCheck={false}>{r.sku}</span>
                  <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", INVENTORY_CLASS_STYLES[r.inventoryClass])}>{INVENTORY_CLASS_LABELS[r.inventoryClass]}</span>
                  {r.lowStock && <span className="rounded-md bg-red-500/12 px-2 py-0.5 text-[10px] font-semibold text-red-700">Low stock</span>}
                  {r.reorderAlert && <span className="rounded-md bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Reorder</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.warehouseName ?? "—"} · {r.valuationMethod} · {r.rotationPolicy} · {r.batchCount} batches</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{r.availableQty} {r.unit}</p>
                <p className="text-[11px] text-muted-foreground">{formatInr(r.stockValue)}</p>
              </div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", r.lowStock ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${Math.min(100, (r.availableQty / Math.max(r.reorderPoint, 1)) * 100)}%` }} />
            </div>
          </motion.div>
        ))}
      </div>

      {(transfers.length > 0 || pickPack.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {transfers.length > 0 && (
            <div className="rounded-xl border p-4">
              <p className="mb-2 text-sm font-medium">Warehouse transfers</p>
              {transfers.slice(0, 5).map((t) => (
                <p key={t.id} className="text-xs">{t.transferNumber}: {t.fromWarehouse} → {t.toWarehouse} ({t.status})</p>
              ))}
            </div>
          )}
          {pickPack.length > 0 && (
            <div className="rounded-xl border p-4">
              <p className="mb-2 text-sm font-medium">Pick · pack · dispatch</p>
              {pickPack.slice(0, 5).map((p) => (
                <p key={p.id} className="text-xs">{p.dispatchNumber} — {p.status} ({p.lineCount} lines)</p>
              ))}
            </div>
          )}
        </div>
      )}

      {recentAudit.length > 0 && (
        <div className="rounded-xl border p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Archive className="h-4 w-4" /> Audit trail</p>
          {recentAudit.slice(0, 6).map((a) => (
            <p key={a.id} className="text-xs text-muted-foreground">{a.title} · {formatDate(a.createdAt)}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Warehouse; label: string; value: string; sub: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="erp-kpi-card rounded-xl border border-border/60 p-4">
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium"><BarChart3 className="h-4 w-4" />{title}</p>
      {children}
    </div>
  );
}
