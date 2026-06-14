"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProcurementHubAnalytics } from "@/lib/procurement-types";
import { LIFECYCLE_LABELS, LIFECYCLE_STYLES } from "@/lib/procurement-types";
import { formatInr } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  IndianRupee,
  PackageCheck,
  Scale,
  TrendingUp,
  Truck,
} from "lucide-react";

const CHART_COLORS = ["#B68D40", "#1E3A5F", "#059669", "#7C3AED", "#DC2626", "#64748B"];

export function ProcurementPlatform({ analytics }: { analytics: ProcurementHubAnalytics }) {
  const [drillStage, setDrillStage] = useState<string | null>(null);
  const { kpis, lifecycle, spendTrend, categorySpend, vendorComparison, payablesAging, topPayables, forecast } =
    analytics;

  const filteredLifecycle = drillStage ? lifecycle.filter((l) => l.stage === drillStage) : lifecycle;

  const kpiCards = [
    { label: "Spend this month", value: formatInr(kpis.spendThisMonth), sub: `${formatInr(kpis.spendLastMonth)} last month`, icon: IndianRupee },
    { label: "Outstanding payables", value: formatInr(kpis.outstandingPayables), sub: `${formatInr(kpis.overduePayables)} overdue`, icon: Scale, alert: kpis.overduePayables > 0 },
    { label: "Open RFQs", value: String(kpis.activeRfqs), sub: "Quote comparison ready", icon: ClipboardCheck },
    { label: "Pending GRNs", value: String(kpis.pendingGrns), sub: `${kpis.qcHolds} QC hold`, icon: PackageCheck },
    { label: "Approvals pending", value: String(kpis.pendingApprovals), sub: "3-level workflow", icon: Truck },
    { label: "Budget utilization", value: `${kpis.budgetUtilizationPct}%`, sub: `${kpis.budgetAlerts} overspend alert(s)`, icon: AlertTriangle, alert: kpis.budgetAlerts > 0 },
  ];

  return (
    <div className="space-y-6">
      {kpis.budgetAlerts > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" />
          <p>
            <span className="font-semibold">{kpis.budgetAlerts} budget line(s)</span> exceeded alert threshold.
            <Link href="/procurement/budgets" className="ml-2 font-semibold text-[#967235] hover:underline">
              Review budgets →
            </Link>
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpiCards.map((c) => (
          <div key={c.label} className={cn("erp-kpi-card p-4", c.alert && "border-amber-500/40")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <p className="mt-1 text-xl font-bold text-[#B68D40]">{c.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
              </div>
              <c.icon className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>

      <div className="erp-kpi-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Procurement lifecycle</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Draft → RFQ → PO → GRN → Quality → Bill → Payment · synchronized from live data
            </p>
          </div>
          {drillStage && (
            <button
              type="button"
              className="text-xs font-medium text-[#967235] hover:underline"
              onClick={() => setDrillStage(null)}
            >
              Clear filter
            </button>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {lifecycle.map((step) => (
            <button
              key={step.stage}
              type="button"
              onClick={() => setDrillStage(drillStage === step.stage ? null : step.stage)}
              className={cn(
                "min-w-[100px] rounded-xl border px-3 py-2.5 text-left transition hover:border-[#B68D40]/50",
                drillStage === step.stage && "ring-2 ring-[#B68D40]/40",
              )}
            >
              <span
                className={cn(
                  "inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                  LIFECYCLE_STYLES[step.stage],
                )}
              >
                {LIFECYCLE_LABELS[step.stage]}
              </span>
              <p className="mt-1 text-lg font-bold">{step.count}</p>
              <p className="text-xs text-[#B68D40]">{formatInr(step.value)}</p>
              {step.href && (
                <Link href={step.href} className="mt-1 flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-[#967235]">
                  Drill down <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </button>
          ))}
        </div>
        <div className="mt-4 min-h-[200px] w-full">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={filteredLifecycle.map((s) => ({ name: LIFECYCLE_LABELS[s.stage], count: s.count, value: s.value }))}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v, name) => (name === "value" ? formatInr(Number(v)) : v)} />
              <Bar yAxisId="left" dataKey="count" fill="#1E3A5F" radius={[4, 4, 0, 0]} name="Orders" />
              <Bar yAxisId="right" dataKey="value" fill="#B68D40" radius={[4, 4, 0, 0]} name="Value" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Monthly spend & forecast" subtitle="Actual vs projected procurement">
          <div className="min-h-[220px] w-full">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={spendTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatInr(Number(v))} />
                <Legend />
                <Bar dataKey="spend" fill="#1E3A5F" name="Actual" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="forecast" stroke="#B68D40" strokeWidth={2} dot={false} name="Forecast" />
                {spendTrend.some((s) => s.budget) && (
                  <Line type="monotone" dataKey="budget" stroke="#059669" strokeDasharray="4 4" dot={false} name="Budget" />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Category-wise procurement" subtitle="Spend by supplier classification">
          <div className="min-h-[220px] w-full">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categorySpend} dataKey="spend" nameKey="label" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                  {categorySpend.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatInr(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="Vendor performance comparison" subtitle="Spend · quality · delivery · rejection" className="lg:col-span-2">
          <div className="min-h-[240px] w-full">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={vendorComparison} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="vendorName" tick={{ fontSize: 10 }} width={75} />
                <Tooltip formatter={(v, name) => (name === "spend" ? formatInr(Number(v)) : `${v}%`)} />
                <Bar dataKey="spend" fill="#B68D40" name="Spend" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Vendor</th>
                  <th className="py-2 pr-2">On-time</th>
                  <th className="py-2 pr-2">Quality</th>
                  <th className="py-2">Reject %</th>
                </tr>
              </thead>
              <tbody>
                {vendorComparison.slice(0, 5).map((v) => (
                  <tr key={v.vendorId} className="border-b border-border/40">
                    <td className="py-2">{v.rank}</td>
                    <td className="py-2">
                      <Link href={`/vendors/${v.vendorId}`} className="font-medium hover:text-[#B68D40]">
                        {v.vendorName}
                      </Link>
                    </td>
                    <td className="py-2">{v.onTimePct.toFixed(0)}%</td>
                    <td className="py-2">{v.qualityScore.toFixed(1)}%</td>
                    <td className="py-2">{v.rejectionRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard title="Payables aging" subtitle="Outstanding vendor balances">
          <div className="min-h-[180px] w-full">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={payablesAging}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatInr(Number(v))} />
                <Bar dataKey="amount" fill="#DC2626" radius={[4, 4, 0, 0]} name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Link href="/procurement/payables" className="mt-2 inline-flex text-xs font-semibold text-[#967235] hover:underline">
            Full payables register →
          </Link>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Procurement forecast" subtitle="6-month projection">
          <div className="min-h-[200px] w-full">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatInr(Number(v))} />
                <Area type="monotone" dataKey="actual" stroke="#1E3A5F" fill="#1E3A5F" fillOpacity={0.2} name="Actual" />
                <Area type="monotone" dataKey="forecast" stroke="#B68D40" fill="#B68D40" fillOpacity={0.15} name="Forecast" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <div className="erp-kpi-card p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#B68D40]" />
            <h3 className="text-sm font-semibold">Food manufacturing intelligence</h3>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{analytics.seasonalInsight}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Metric label="Avg quality" value={`${kpis.avgQualityScore}%`} />
            <Metric label="Rejection rate" value={`${kpis.avgRejectionRate}%`} />
            <Metric label="On-time delivery" value={`${kpis.onTimeDeliveryPct}%`} />
            <Metric label="Contracts expiring" value={String(kpis.expiringContracts)} />
          </div>
        </div>
      </div>

      <div className="erp-kpi-card p-5">
        <h3 className="text-sm font-semibold">Top outstanding payables</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">PO #</th>
                <th className="py-2 pr-3">Vendor</th>
                <th className="py-2 pr-3">Balance</th>
                <th className="py-2 pr-3">Due</th>
                <th className="py-2">Stage</th>
              </tr>
            </thead>
            <tbody>
              {topPayables.map((p) => (
                <tr key={p.id} className="border-b border-border/40">
                  <td className="py-2.5 font-mono text-xs">{p.purchaseNumber}</td>
                  <td className="py-2.5">
                    <Link href={`/vendors/${p.vendorId}`} className="hover:text-[#B68D40]">
                      {p.vendorName}
                    </Link>
                  </td>
                  <td className="py-2.5 font-semibold text-amber-700">{formatInr(p.balance)}</td>
                  <td className="py-2.5 text-xs text-muted-foreground">
                    {p.dueDate ? new Date(p.dueDate).toLocaleDateString("en-IN") : "—"}
                    {p.daysOverdue > 0 && (
                      <span className="ml-1 text-red-600">({p.daysOverdue}d overdue)</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", LIFECYCLE_STYLES[p.stage])}>
                      {LIFECYCLE_LABELS[p.stage]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <NavCard href="/procurement/rfq" label="RFQ & comparison" />
        <NavCard href="/procurement/grn" label="GRN management" />
        <NavCard href="/procurement/approvals" label="Approvals" />
        <NavCard href="/procurement/payables" label="Payables" />
        <NavCard href="/procurement/budgets" label="Budget control" />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("erp-kpi-card p-5", className)}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-bold text-[#B68D40]">{value}</p>
    </div>
  );
}

function NavCard({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="erp-kpi-card flex items-center justify-between p-4 transition hover:border-[#B68D40]/40">
      <span className="text-sm font-semibold">{label}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
