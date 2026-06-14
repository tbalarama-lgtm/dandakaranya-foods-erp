"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  GitBranch,
  MapPin,
  Package,
  Search,
  Truck,
  Warehouse,
} from "lucide-react";
import type { WarehouseFacilityKind } from "@prisma/client";
import { runWarehouseForecast } from "@/actions/warehouse-workflow";
import type { WarehouseHubBundle } from "@/lib/warehouse-types";
import {
  AUDIT_ACTION_LABELS,
  FACILITY_KIND_LABELS,
  FACILITY_KIND_STYLES,
  TRANSFER_STATUS_LABELS,
  TRANSFER_STATUS_STYLES,
} from "@/lib/warehouse-types";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Tab = "overview" | "branches" | "warehouses" | "distribution" | "map";

export function WarehouseGovernanceHub({
  bundle,
  canEdit,
}: {
  bundle: WarehouseHubBundle;
  canEdit: boolean;
}) {
  const { kpis, branches, warehouses, distributionCenters, transfers, dispatches, tasks, mapPoints, utilizationTrend, agingBuckets, recentAudit } =
    bundle;
  const [tab, setTab] = useState<Tab>("overview");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<WarehouseFacilityKind | "">("");
  const [pending, startTransition] = useTransition();

  const filteredWarehouses = useMemo(() => {
    let list = [...warehouses];
    if (kind) list = list.filter((w) => w.facilityKind === kind);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(
        (w) =>
          w.name.toLowerCase().includes(s) ||
          w.code.toLowerCase().includes(s) ||
          (w.branchName?.toLowerCase().includes(s) ?? false) ||
          (w.city?.toLowerCase().includes(s) ?? false),
      );
    }
    return list;
  }, [warehouses, q, kind]);

  function handleForecast(warehouseId: string) {
    startTransition(async () => {
      const res = await runWarehouseForecast(warehouseId);
      if (res.ok) toast.success(`AI forecast updated (${res.data.points} SKUs)`);
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {(kpis.overflowAlerts > 0 || kpis.quarantineQty > 0) && (
        <div className="space-y-2">
          {kpis.overflowAlerts > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" />
              {kpis.overflowAlerts} warehouse(s) above capacity threshold — overflow action required.
            </div>
          )}
          {kpis.quarantineQty > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/8 px-4 py-3 text-sm">
              <Package className="h-4 w-4 shrink-0" />
              {Math.round(kpis.quarantineQty)} units in quarantine across network.
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Building2} label="Network" value={String(kpis.branchCount)} sub={`${kpis.warehouseCount} WH · ${kpis.distributionCenterCount} DC`} />
        <Kpi icon={Warehouse} label="Inventory value" value={formatInr(kpis.totalInventoryValue)} sub={`${kpis.activeSkus} active SKUs`} />
        <Kpi icon={Truck} label="Logistics ops" value={String(kpis.openTransfers + kpis.pendingDispatch)} sub={`${kpis.openTasks} open tasks · ${kpis.dockToday} dock today`} />
        <Kpi icon={BarChart3} label="Efficiency" value={`${kpis.dispatchEfficiencyPct}%`} sub={`Util ${kpis.avgUtilizationPct}% · Turn ${kpis.turnoverDays}d`} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["overview", "Overview"],
            ["branches", "Branches"],
            ["warehouses", "Warehouses"],
            ["distribution", "Distribution centers"],
            ["map", "Geo map"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", tab === id ? "bg-[#B68D40] text-white" : "bg-muted")}
          >
            {label}
          </button>
        ))}
        <Link href="/warehouses/transfers" className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/80">
          Transfers →
        </Link>
        <Link href="/warehouses/dispatch" className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/80">
          Dispatch →
        </Link>
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Warehouse utilization">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={utilizationTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="%" />
                <Tooltip />
                <Bar dataKey="utilization" fill="#B68D40" radius={[4, 4, 0, 0]} name="Utilization %" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Stock aging (qty)">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agingBuckets}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="qty" fill="#64748b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <OverviewPanel title="Recent transfers" empty="No transfers">
            {transfers.slice(0, 5).map((t) => (
              <p key={t.id} className="text-xs">
                <span className={cn("mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold", TRANSFER_STATUS_STYLES[t.status])}>
                  {TRANSFER_STATUS_LABELS[t.status]}
                </span>
                {t.transferNumber}: {t.fromWarehouse} → {t.toWarehouse}
              </p>
            ))}
          </OverviewPanel>
          <OverviewPanel title="Open tasks" empty="No open tasks">
            {tasks.slice(0, 5).map((t) => (
              <p key={t.id} className="text-xs">
                {t.title} · {t.warehouseName} {t.binCode ? `· ${t.binCode}` : ""}
              </p>
            ))}
          </OverviewPanel>
        </div>
      )}

      {tab === "branches" && (
        <EntityList
          q={q}
          setQ={setQ}
          placeholder="Search branches…"
          rows={branches.filter((b) => !q || b.name.toLowerCase().includes(q.toLowerCase()) || b.code.toLowerCase().includes(q.toLowerCase()))}
          render={(b) => (
            <Link href={`/branches/${b.id}`} className="block rounded-xl border border-border/60 p-4 hover:border-[#B68D40]/40">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{b.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{b.code} · {b.region ?? ([b.city, b.state].filter(Boolean).join(", ") || "—")}</p>
                </div>
                <div className="text-right text-xs">
                  <p>{b.warehouseCount} WH · {b.dcCount} DC</p>
                  <p className="font-medium">{formatInr(b.inventoryValue)}</p>
                </div>
              </div>
            </Link>
          )}
        />
      )}

      {tab === "warehouses" && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setKind("")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", !kind ? "bg-[#B68D40] text-white" : "bg-muted")}>All types</button>
            {(["WAREHOUSE", "DISTRIBUTION_CENTER", "COLD_STORAGE", "QUARANTINE_YARD"] as WarehouseFacilityKind[]).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", kind === k ? "bg-[#B68D40] text-white" : "bg-muted")}>
                {FACILITY_KIND_LABELS[k]}
              </button>
            ))}
          </div>
          <EntityList
            q={q}
            setQ={setQ}
            placeholder="Search warehouses…"
            rows={filteredWarehouses}
            render={(w) => (
              <motion.div key={w.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/warehouses/${w.id}`} className="font-semibold text-[#B68D40] hover:underline">{w.name}</Link>
                      <span className="font-mono text-[10px] text-muted-foreground">{w.code}</span>
                      <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", FACILITY_KIND_STYLES[w.facilityKind])}>{FACILITY_KIND_LABELS[w.facilityKind]}</span>
                      {w.overflow && <span className="rounded-md bg-red-500/12 px-2 py-0.5 text-[10px] font-semibold text-red-700">Overflow</span>}
                      {w.isColdStorage && <span className="rounded-md bg-cyan-500/12 px-2 py-0.5 text-[10px] font-semibold text-cyan-800">Cold</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{w.branchName ?? "—"} · {w.binCount} bins · {w.batchCount} batches · {w.activeSkus} SKUs</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{formatInr(w.inventoryValue)}</p>
                    <p className="text-[11px] text-muted-foreground">Util {w.utilizationPct}% · Pallet {w.palletUtilizationPct}%</p>
                    {canEdit && (
                      <Button size="sm" variant="ghost" className="mt-1 h-7 text-[10px]" disabled={pending} onClick={() => handleForecast(w.id)}>
                        AI forecast
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", w.overflow ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${Math.min(100, w.utilizationPct)}%` }} />
                </div>
              </motion.div>
            )}
          />
        </>
      )}

      {tab === "distribution" && (
        <EntityList
          q={q}
          setQ={setQ}
          placeholder="Search distribution centers…"
          rows={distributionCenters.filter((d) => !q || d.name.toLowerCase().includes(q.toLowerCase()))}
          render={(d) => (
            <div key={d.id} className="rounded-xl border border-border/60 p-4">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.code} · {d.region ?? "—"} · {d.branchName ?? "—"}</p>
                </div>
                <div className="text-right text-xs">
                  <p>{d.warehouseCount} linked WH</p>
                  <p>Pallet cap {d.palletCapacity}</p>
                </div>
              </div>
            </div>
          )}
        />
      )}

      {tab === "map" && (
        <div className="rounded-xl border border-border/60 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium"><MapPin className="h-4 w-4" /> Network geo-locations</p>
          {mapPoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add latitude/longitude to branches and warehouses for map integration.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {mapPoints.map((p) => (
                <div key={`${p.kind}-${p.id}`} className="rounded-lg border border-border/40 p-3 text-xs">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-muted-foreground capitalize">{p.kind} · {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}</p>
                  <a
                    href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-[#B68D40] hover:underline"
                  >
                    Open in Google Maps
                  </a>
                  {p.inventoryValue > 0 && <p className="mt-1">{formatInr(p.inventoryValue)} · Util {p.utilizationPct}%</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {recentAudit.length > 0 && tab === "overview" && (
        <div className="rounded-xl border p-4">
          <p className="mb-2 text-sm font-medium">Warehouse audit trail</p>
          {recentAudit.map((a) => (
            <p key={a.id} className="text-xs text-muted-foreground">
              {AUDIT_ACTION_LABELS[a.action]} — {a.title} · {formatDate(a.createdAt)}
            </p>
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

function OverviewPanel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function EntityList<T>({
  q,
  setQ,
  placeholder,
  rows,
  render,
}: {
  q: string;
  setQ: (v: string) => void;
  placeholder: string;
  rows: T[];
  render: (row: T) => React.ReactNode;
}) {
  return (
    <>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} className="h-10 w-full rounded-xl border pl-9 pr-3 text-sm" />
      </div>
      <div className="space-y-3">{rows.map(render)}</div>
    </>
  );
}
