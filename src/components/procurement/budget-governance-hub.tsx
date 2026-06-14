"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Lock,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Unlock,
  Wallet,
} from "lucide-react";
import type { BudgetLifecycleStatus, BudgetScenarioType } from "@prisma/client";
import { lockBudget, unlockBudget, runBudgetForecast } from "@/actions/budget-workflow";
import type { BudgetHubBundle } from "@/lib/budget-types";
import {
  BUDGET_SCENARIO_LABELS,
  BUDGET_STATUS_LABELS,
  BUDGET_STATUS_STYLES,
  BUDGET_TIER_LABELS,
  BUDGET_TIER_STYLES,
} from "@/lib/budget-types";
import { VENDOR_CLASSIFICATION_LABELS } from "@/lib/vendor-types";
import { Button } from "@/components/ui/button";
import { formatInr, cn } from "@/lib/utils";
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

export function BudgetGovernanceHub({
  bundle,
  canEdit,
}: {
  bundle: BudgetHubBundle;
  canEdit: boolean;
}) {
  const { rows, kpis, categoryAllocation, varianceTrend, scenarioForecasts, recentAudit, pendingApprovals, multiYearPlans } = bundle;
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<BudgetLifecycleStatus | "">("");
  const [scenario, setScenario] = useState<BudgetScenarioType | "">("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    let list = [...rows];
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(
        (r) =>
          r.label.toLowerCase().includes(s) ||
          (r.department?.toLowerCase().includes(s) ?? false) ||
          (r.region?.toLowerCase().includes(s) ?? false),
      );
    }
    if (statusFilter) list = list.filter((r) => r.status === statusFilter);
    if (scenario) list = list.filter((r) => r.scenario === scenario);
    return list;
  }, [rows, q, statusFilter, scenario]);

  const activeScenario = scenarioForecasts.find((s) => s.scenario === (scenario || "EXPECTED")) ?? scenarioForecasts[1];

  function handleLock(id: string, lock: boolean) {
    startTransition(async () => {
      const res = lock
        ? await lockBudget(id, "Manual lock — utilization control")
        : await unlockBudget(id);
      if (res.ok) toast.success(lock ? "Budget locked" : "Budget unlocked");
      else toast.error(res.error);
    });
  }

  function handleForecast(id: string) {
    startTransition(async () => {
      const res = await runBudgetForecast(id);
      if (res.ok) toast.success(`Forecast: ${formatInr(res.data.forecast)}/mo`);
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {(kpis.warningCount > 0 || kpis.criticalCount > 0 || kpis.lockedCount > 0) && (
        <div className="space-y-2">
          {kpis.criticalCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3 text-sm text-red-800">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {kpis.criticalCount} budget line(s) at critical threshold (90%+) — overspend approval escalation active.
            </div>
          )}
          {kpis.warningCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {kpis.warningCount} budget line(s) exceeded 70% utilization warning threshold.
            </div>
          )}
          {kpis.lockedCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/8 px-4 py-3 text-sm text-violet-900">
              <Lock className="h-4 w-4 shrink-0" />
              {kpis.lockedCount} budget line(s) locked — new PO commitments blocked at 100% utilization.
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Wallet} label="Total budget" value={formatInr(kpis.totalBudget)} sub={`${formatInr(kpis.totalRemaining)} remaining`} />
        <Kpi icon={TrendingUp} label="Utilization" value={`${kpis.avgUtilizationPct}%`} sub={`${formatInr(kpis.totalSpent)} spent · ${formatInr(kpis.totalCommitted)} committed`} />
        <Kpi icon={BarChart3} label="Forecast accuracy" value={`${kpis.forecastAccuracyPct}%`} sub={`Procurement efficiency ${kpis.procurementEfficiencyPct}%`} />
        <Kpi icon={ShieldAlert} label="Alerts" value={String(kpis.warningCount + kpis.criticalCount)} sub={`${kpis.pendingApprovals} pending approvals · ${kpis.seasonalBudgets} seasonal`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Planned vs actual variance">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={varianceTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
              <Legend />
              <Bar dataKey="planned" fill="#94a3b8" name="Planned" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" fill="#B68D40" name="Actual" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`Spend forecast — ${activeScenario?.label ?? "Expected"}`}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={activeScenario?.monthly ?? []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
              <Line type="monotone" dataKey="amount" stroke="#B68D40" strokeWidth={2} name="AI forecast" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border/60 p-4">
          <p className="mb-3 text-sm font-medium">Category allocation</p>
          <div className="space-y-3">
            {categoryAllocation.map((c) => (
              <div key={c.classification}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">{c.label}</span>
                  <span className={cn("rounded px-1.5 py-0.5 font-semibold", BUDGET_TIER_STYLES[c.tier])}>
                    {c.utilizationPct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", c.tier === "LOCKED" || c.tier === "CRITICAL" ? "bg-red-500" : c.tier === "WARNING" ? "bg-amber-500" : "bg-emerald-500")}
                    style={{ width: `${Math.min(c.utilizationPct, 100)}%` }}
                  />
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatInr(c.spent + c.committed)} / {formatInr(c.budget)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {multiYearPlans.length > 0 && (
            <div className="rounded-xl border border-border/60 p-4">
              <p className="mb-2 text-sm font-medium">Multi-year plans</p>
              {multiYearPlans.map((p) => (
                <div key={p.id} className="mb-2 text-xs">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-muted-foreground">
                    {p.startYear}–{p.endYear} · {BUDGET_SCENARIO_LABELS[p.scenario]} · {formatInr(p.totalPlanned)}
                  </p>
                </div>
              ))}
            </div>
          )}
          {pendingApprovals.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="mb-2 text-sm font-medium">Pending approvals</p>
              {pendingApprovals.slice(0, 4).map((a) => (
                <Link key={a.id} href={`/procurement/budgets/${a.budgetId}`} className="block text-xs text-[#B68D40] hover:underline">
                  {a.budgetLabel} — {a.approvalType}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["", "ACTIVE", "LOCKED", "PENDING_APPROVAL"] as const).map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium",
              statusFilter === s ? "bg-[#B68D40] text-white" : "bg-muted text-muted-foreground",
            )}
          >
            {s ? BUDGET_STATUS_LABELS[s] : "All statuses"}
          </button>
        ))}
        {(["", "OPTIMISTIC", "EXPECTED", "INFLATION_ADJUSTED"] as const).map((s) => (
          <button
            key={s || "sc-all"}
            type="button"
            onClick={() => setScenario(s)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium",
              scenario === s ? "bg-sky-600 text-white" : "bg-muted text-muted-foreground",
            )}
          >
            {s ? BUDGET_SCENARIO_LABELS[s] : "All scenarios"}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search budget, department, region…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm"
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            No budget lines match your filters.
          </div>
        ) : (
          filtered.map((b) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/procurement/budgets/${b.id}`} className="font-semibold text-[#B68D40] hover:underline">
                      {b.label}
                    </Link>
                    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", BUDGET_STATUS_STYLES[b.status])}>
                      {BUDGET_STATUS_LABELS[b.status]}
                    </span>
                    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", BUDGET_TIER_STYLES[b.tier])}>
                      {BUDGET_TIER_LABELS[b.tier]}
                    </span>
                    {b.seasonalFlag && (
                      <span className="rounded-md bg-orange-500/12 px-2 py-0.5 text-[10px] font-semibold text-orange-800">Seasonal</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    FY {b.fiscalYear}
                    {b.month != null ? ` · Month ${b.month}` : ""}
                    {b.classification ? ` · ${VENDOR_CLASSIFICATION_LABELS[b.classification]}` : ""}
                    {b.department ? ` · ${b.department}` : ""}
                    {b.warehouseName ? ` · ${b.warehouseName}` : ""}
                    {b.region ? ` · ${b.region}` : ""}
                  </p>
                  {(b.fpoAllocationPct != null || b.packagingForecast != null || b.yieldBudgetPct != null) && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {b.fpoAllocationPct != null && `FPO ${b.fpoAllocationPct}% · `}
                      {b.packagingForecast != null && `Packaging ${formatInr(b.packagingForecast)} · `}
                      {b.logisticsForecast != null && `Logistics ${formatInr(b.logisticsForecast)} · `}
                      {b.yieldBudgetPct != null && `Yield target ${b.yieldBudgetPct}%`}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{b.utilizationPct}%</p>
                  <p className="text-[11px] text-muted-foreground">{formatInr(b.remaining)} left</p>
                </div>
              </div>

              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", b.tier === "LOCKED" || b.tier === "CRITICAL" ? "bg-red-500" : b.tier === "WARNING" ? "bg-amber-500" : "bg-emerald-500")}
                  style={{ width: `${Math.min(b.utilizationPct, 100)}%` }}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Stat label="Budget" value={formatInr(b.budgetAmount)} />
                <Stat label="Spent" value={formatInr(b.spentAmount)} />
                <Stat label="Committed" value={formatInr(b.committedAmount)} />
                <Stat label="Forecast" value={b.forecastAmount != null ? formatInr(b.forecastAmount) : "—"} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="ghost" asChild>
                  <Link href={`/procurement/budgets/${b.id}`}>Details & audit</Link>
                </Button>
                {canEdit && (
                  <>
                    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => handleForecast(b.id)}>
                      <TrendingDown className="mr-1 h-3.5 w-3.5" />
                      Run forecast
                    </Button>
                    {b.isLocked ? (
                      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => handleLock(b.id, false)}>
                        <Unlock className="mr-1 h-3.5 w-3.5" />
                        Unlock
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => handleLock(b.id, true)}>
                        <Lock className="mr-1 h-3.5 w-3.5" />
                        Lock
                      </Button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {recentAudit.length > 0 && (
        <div className="rounded-xl border border-border/60 p-4">
          <p className="mb-3 text-sm font-medium">Recent audit trail</p>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {recentAudit.slice(0, 8).map((e) => (
              <div key={e.id} className="border-l-2 border-[#B68D40]/40 pl-3 text-xs">
                <p className="font-medium">{e.title}</p>
                <p className="text-muted-foreground">{e.budgetLabel} · {e.actorName ?? "System"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Wallet; label: string; value: string; sub: string }) {
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
      <p className="mb-3 text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
