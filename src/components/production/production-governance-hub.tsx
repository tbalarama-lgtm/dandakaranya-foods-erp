"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Cog,
  Factory,
  Gauge,
  Package,
  TrendingUp,
} from "lucide-react";
import type { ProductionStatus } from "@prisma/client";
import { runProductionOptimization } from "@/actions/production-workflow";
import type { ProductionHubBundle } from "@/lib/production-types";
import {
  ALERT_TYPE_LABELS,
  AUDIT_ACTION_LABELS,
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUS_STYLES,
  STAGE_LABELS,
} from "@/lib/production-types";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Tab = "overview" | "orders" | "mrp" | "machines" | "alerts";

export function ProductionGovernanceHub({
  bundle,
  canEdit,
}: {
  bundle: ProductionHubBundle;
  canEdit: boolean;
}) {
  const { kpis, batches, machines, mrpLines, alerts, oeeTrend, stageThroughput, shiftOutput, recentAudit } = bundle;
  const [tab, setTab] = useState<Tab>("overview");
  const [statusFilter, setStatusFilter] = useState<ProductionStatus | "">("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!statusFilter) return batches;
    return batches.filter((b) => b.status === statusFilter);
  }, [batches, statusFilter]);

  function handleOptimize() {
    startTransition(async () => {
      const res = await runProductionOptimization();
      if (res.ok) toast.success(`AI optimization complete — bottleneck score ${res.data.score}`);
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {(kpis.openAlerts > 0 || kpis.materialShortages > 0 || kpis.delayedBatches > 0) && (
        <div className="space-y-2">
          {kpis.materialShortages > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm">
              <Package className="h-4 w-4 shrink-0 text-amber-700" />
              {kpis.materialShortages} MRP shortage(s) — procurement integration recommended.
            </div>
          )}
          {kpis.delayedBatches > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" />
              {kpis.delayedBatches} batch(es) past scheduled end — review Gantt schedule.
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Factory} label="Active production" value={String(kpis.activeBatches)} sub={`${kpis.inProduction} running · ${kpis.qcHold} QC`} />
        <Kpi icon={Gauge} label="OEE / utilization" value={`${kpis.oeeAvg}%`} sub={`Machine util ${kpis.machineUtilization}% · DT ${kpis.downtimeHours}h`} />
        <Kpi icon={TrendingUp} label="Yield / output" value={`${kpis.yieldAvgPct}%`} sub={`Today ${kpis.productionToday}/${kpis.targetToday} kg`} />
        <Kpi icon={AlertTriangle} label="Alerts" value={String(kpis.openAlerts)} sub={`${kpis.plannedOrders} planned · ${kpis.materialShortages} shortages`} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["overview", "MES overview"],
            ["orders", "Production orders"],
            ["mrp", "MRP"],
            ["machines", "Machines & OEE"],
            ["alerts", "Alerts"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", tab === id ? "bg-[#B68D40] text-white" : "bg-muted")}>
            {label}
          </button>
        ))}
        <Link href="/production/schedule" className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/80">Gantt schedule →</Link>
        {canEdit && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={handleOptimize}>AI optimize</Button>
        )}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="OEE trend">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={oeeTrend.length ? oeeTrend : [{ label: "—", oee: kpis.oeeAvg, availability: 85, performance: 88, quality: 92 }]}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="oee" stroke="#B68D40" name="OEE" dot={false} />
                <Line type="monotone" dataKey="availability" stroke="#64748b" name="Availability" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Shift output">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={shiftOutput}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="shift" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="planned" fill="#94a3b8" name="Planned" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" fill="#B68D40" name="Actual" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Stage throughput">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stageThroughput}>
                <XAxis dataKey="stage" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="output" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          {recentAudit.length > 0 && (
            <div className="rounded-xl border border-border/60 p-4">
              <p className="mb-2 text-sm font-medium">MES audit trail</p>
              {recentAudit.slice(0, 6).map((a) => (
                <p key={a.id} className="text-xs text-muted-foreground">
                  {AUDIT_ACTION_LABELS[a.action]} — {a.title} · {formatDate(a.createdAt)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "orders" && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setStatusFilter("")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", !statusFilter ? "bg-[#B68D40] text-white" : "bg-muted")}>All</button>
            {(["PLANNED", "RELEASED", "IN_PROGRESS", "QC", "COMPLETED"] as ProductionStatus[]).map((s) => (
              <button key={s} type="button" onClick={() => setStatusFilter(s)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", statusFilter === s ? "bg-[#B68D40] text-white" : "bg-muted")}>
                {PRODUCTION_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {filtered.map((b) => (
              <motion.div key={b.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/production/batches/${b.id}`} className="font-semibold text-[#B68D40] hover:underline">{b.batchCode}</Link>
                      <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", PRODUCTION_STATUS_STYLES[b.status])}>{PRODUCTION_STATUS_LABELS[b.status]}</span>
                      {b.delayed && <span className="rounded-md bg-red-500/12 px-2 py-0.5 text-[10px] font-semibold text-red-700">Delayed</span>}
                      {b.currentStage && <span className="rounded-md bg-sky-500/12 px-2 py-0.5 text-[10px] font-semibold text-sky-700">{STAGE_LABELS[b.currentStage]}</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{b.productName} · {b.recipeName} · {b.machineName ?? "—"} · {b.shiftName ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{b.plannedQty} kg</p>
                    <p className="text-[11px] text-muted-foreground">Yield {b.actualYieldPct ?? b.expectedYieldPct}% · {formatInr(b.totalCost)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {tab === "mrp" && (
        <div className="space-y-2">
          {mrpLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open material requirements.</p>
          ) : (
            mrpLines.map((m) => (
              <div key={m.productId} className={cn("flex justify-between rounded-xl border px-4 py-3 text-sm", m.shortageQty > 0 && "border-amber-500/40 bg-amber-500/5")}>
                <span>{m.productName} <span className="font-mono text-[10px] text-muted-foreground">{m.sku}</span></span>
                <span>Req {m.requiredQty} · Avail {m.availableQty} · <strong className={m.shortageQty > 0 ? "text-amber-800" : ""}>Short {m.shortageQty}</strong> {m.unit}</span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "machines" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {machines.map((m) => (
            <div key={m.id} className="rounded-xl border border-border/60 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.code} · {m.line ?? "—"} · {m.branchName ?? "—"}</p>
                </div>
                <Cog className="h-4 w-4 text-[#B68D40]" strokeWidth={ICON_STROKE} />
              </div>
              <p className="mt-2 text-sm">OEE {m.oee}% · Util {m.utilizationPct}% · TP {m.throughputKg} kg/h</p>
              <p className="text-xs text-muted-foreground">DT {m.downtimeHours}h · PM {m.nextMaintenance ? formatDate(m.nextMaintenance) : "—"}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "alerts" && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className="rounded-xl border border-border/60 px-4 py-3 text-sm">
              <span className="font-medium">{ALERT_TYPE_LABELS[a.alertType]}</span> — {a.title}
              {a.batchCode && <span className="ml-2 font-mono text-[10px]">{a.batchCode}</span>}
              <p className="text-xs text-muted-foreground">{a.message ?? ""} · {formatDate(a.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Factory; label: string; value: string; sub: string }) {
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
