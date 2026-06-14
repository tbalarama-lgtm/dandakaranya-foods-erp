"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsReportMetrics } from "@/lib/analytics-types";
import { formatInr } from "@/lib/utils";
import { LeadFunnelChart, SalesForecastChart } from "@/components/reports/lead-funnel-chart";

const COLORS = ["#B68D40", "#1E3A5F", "#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899"];

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`erp-kpi-card flex flex-col p-5 ${className ?? ""}`}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="min-h-[240px] flex-1">{children}</div>
    </motion.div>
  );
}

function InrTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatInr(p.value)}
        </p>
      ))}
    </div>
  );
}

export function AnalyticsCharts({ metrics }: { metrics: AnalyticsReportMetrics }) {
  const [drillMonth, setDrillMonth] = useState<string | null>(null);

  const drillData = drillMonth
    ? metrics.revenueTrend.find((r) => r.month === drillMonth)
    : null;

  const marginData = metrics.revenueTrend.map((r) => ({
    month: r.month,
    margin: r.revenue > 0 ? ((r.revenue - r.purchases - r.expenses) / r.revenue) * 100 : 0,
    revenue: r.revenue,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Revenue trends"
          subtitle="Click a month to drill down · animated comparison vs purchases & expenses"
        >
          {drillData ? (
            <div className="space-y-3">
              <button
                type="button"
                className="text-xs text-[#B68D40] hover:underline"
                onClick={() => setDrillMonth(null)}
              >
                ← Back to trend view
              </button>
              <p className="text-lg font-semibold">{drillMonth} breakdown</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={[
                    { name: "Revenue", value: drillData.revenue },
                    { name: "Purchases", value: drillData.purchases },
                    { name: "Expenses", value: drillData.expenses },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<InrTooltip />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={700}>
                    {[0, 1, 2].map((i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart
                data={metrics.revenueTrend}
                onClick={(e) => {
                  const month = (e?.activeLabel as string) ?? null;
                  if (month) setDrillMonth(month);
                }}
                style={{ cursor: "pointer" }}
              >
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#B68D40" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#B68D40" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<InrTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#B68D40"
                  fill="url(#revGrad)"
                  strokeWidth={2}
                  animationDuration={900}
                />
                <Line
                  type="monotone"
                  dataKey="purchases"
                  name="Purchases"
                  stroke="#1E3A5F"
                  strokeWidth={2}
                  dot={false}
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Profit margin analysis" subtitle="Monthly margin % with revenue overlay">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={marginData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tickFormatter={(v) => `${v}%`} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip
                formatter={(value, name) =>
                  name === "margin"
                    ? `${Number(value ?? 0).toFixed(1)}%`
                    : formatInr(Number(value ?? 0))
                }
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="margin"
                name="Margin %"
                stroke="#10B981"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                animationDuration={800}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#B68D40"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="Expense breakdown" subtitle="By category">
          {metrics.expenseBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={metrics.expenseBreakdown}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  animationDuration={700}
                >
                  {metrics.expenseBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="GST / tax reporting" subtitle="Audit-ready tax summary">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Collected", value: metrics.gstSummary.collected, color: "text-emerald-600" },
                { label: "On purchases", value: metrics.gstSummary.onPurchases, color: "text-blue-600" },
                { label: "Net liability", value: metrics.gstSummary.net, color: "text-[#B68D40]" },
              ].map((g) => (
                <div key={g.label} className="rounded-lg bg-muted/40 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.label}</p>
                  <p className={`mt-1 text-sm font-semibold ${g.color}`}>{formatInr(g.value)}</p>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart
                data={[
                  { name: "GST", collected: metrics.gstSummary.collected, input: metrics.gstSummary.onPurchases },
                ]}
                layout="vertical"
              >
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
                <Bar dataKey="collected" name="Output GST" fill="#10B981" radius={4} />
                <Bar dataKey="input" name="Input GST" fill="#3B82F6" radius={4} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-muted-foreground">
              {metrics.auditTrail.gstRegistered
                ? "GSTIN registered — data aligned for GSTR-1 / GSTR-3B filing."
                : "Configure GSTIN in company profile for compliance reporting."}
            </p>
          </div>
        </ChartCard>

        <ChartCard title="Sales forecast" subtitle="Linear projection from 6-month trend">
          <SalesForecastChart trend={metrics.revenueTrend} forecast={metrics.forecast} />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Lead pipeline funnel" subtitle="Conversion stages with drill-down">
          <LeadFunnelChart
            stages={metrics.leadFunnel.stages}
            conversionRate={metrics.leadFunnel.conversionRate}
            forecast={metrics.forecast.nextMonthRevenue}
          />
        </ChartCard>

        <ChartCard title="Sales by team member" subtitle="Performance comparison">
          {metrics.userPerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={metrics.userPerformance} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis type="number" tickFormatter={(v) => `₹${v / 1000}k`} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
                <Bar dataKey="revenue" name="Revenue" fill="#B68D40" radius={[0, 6, 6, 0]} animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ProcurementPanel metrics={metrics} />
      <FoodManufacturingPanel metrics={metrics} />
      <AuditPanel metrics={metrics} />
    </div>
  );
}

function ProcurementPanel({ metrics }: { metrics: AnalyticsReportMetrics }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="Procurement intelligence" subtitle="Top suppliers & spend concentration">
        <div className="mb-3 flex gap-4 text-xs">
          <span>
            <strong>{metrics.procurement.vendorCount}</strong> vendors
          </span>
          <span>
            Top vendor share: <strong>{metrics.procurement.topVendorShare}%</strong>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={metrics.procurement.topVendors}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis tickFormatter={(v) => `₹${v / 1000}k`} />
            <Tooltip content={<InrTooltip />} />
            <Bar dataKey="amount" name="Spend" fill="#1E3A5F" radius={[4, 4, 0, 0]} animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Raw material procurement trend" subtitle="Monthly purchase volume">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={metrics.procurement.rawMaterialTrend}>
            <defs>
              <linearGradient id="procGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
            <Area
              type="monotone"
              dataKey="amount"
              name="Procurement"
              stroke="#3B82F6"
              fill="url(#procGrad)"
              strokeWidth={2}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function FoodManufacturingPanel({ metrics }: { metrics: AnalyticsReportMetrics }) {
  const fm = metrics.foodManufacturing;
  const stats = [
    { label: "Batch yield", value: `${fm.batchYield}%`, hint: "Completed batches" },
    { label: "Wastage", value: `${fm.wastagePct}%`, hint: "Of planned output" },
    { label: "QC rejection", value: `${fm.qcRejectionRate}%`, hint: "Quality control" },
    { label: "Expiring (30d)", value: String(fm.expiringCount), hint: "FEFO priority" },
    { label: "Efficiency", value: `${fm.productionEfficiency}%`, hint: "Line utilization" },
    { label: "Batches done", value: String(fm.batchesCompleted), hint: "This period" },
  ];

  return (
    <ChartCard title="Food manufacturing analytics" subtitle="Yield, wastage, QC & expiry tracking">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border/50 bg-muted/30 p-3 text-center"
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-bold">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.hint}</p>
          </motion.div>
        ))}
      </div>
      {fm.byStatus.length > 0 && (
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={fm.byStatus.map((b) => ({ status: b.status, count: b.count }))}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="status" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

function AuditPanel({ metrics }: { metrics: AnalyticsReportMetrics }) {
  const branchLabel =
    metrics.branchId != null
      ? metrics.branches.find((b) => b.id === metrics.branchId)?.name ?? "Selected branch"
      : "All branches (consolidated)";

  return (
    <div className="erp-kpi-card border border-[#B68D40]/20 p-5">
      <h3 className="text-sm font-semibold">Audit-ready financial report</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Structured for statutory review · multi-branch capable
      </p>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <AuditRow label="Reporting period" value={metrics.auditTrail.periodLabel} />
        <AuditRow label="Branch scope" value={branchLabel} />
        <AuditRow label="Generated at" value={new Date(metrics.auditTrail.generatedAt).toLocaleString("en-IN")} />
        <AuditRow label="Inventory (valuation)" value={formatInr(metrics.inventoryValue)} />
        <AuditRow label="Total sales (invoiced)" value={formatInr(metrics.totalSales)} />
        <AuditRow label="Paid collections" value={formatInr(metrics.paidSales)} />
        <AuditRow label="Total purchases" value={formatInr(metrics.totalPurchases)} />
        <AuditRow label="Operating expenses" value={formatInr(metrics.expensesTotal)} />
        <AuditRow label="Net profit / loss" value={formatInr(metrics.profit)} />
        <AuditRow label="GST net" value={formatInr(metrics.gstSummary.net)} />
      </div>
    </div>
  );
}

function AuditRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
