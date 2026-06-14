"use client";

import { motion } from "framer-motion";
import { Area, AreaChart, Line, LineChart, ResponsiveContainer } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { CommandCenterMetrics } from "@/lib/command-center-types";
import { trendLabel } from "@/lib/command-center-types";
import { formatInr, cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";

type KpiDef = {
  label: string;
  value: string;
  sub: string;
  trend: number;
  spark: number[];
  accent: string;
};

export function CommandCenterKpis({ metrics }: { metrics: CommandCenterMetrics }) {
  const kpis: KpiDef[] = [
    {
      label: "Revenue (MTD)",
      value: formatInr(metrics.monthSales),
      sub: `YTD ${formatInr(metrics.revenueYtd)}`,
      trend: metrics.salesTrendPct,
      spark: metrics.kpiSparklines.sales,
      accent: "#B68D40",
    },
    {
      label: "Inventory value",
      value: formatInr(metrics.inventoryValue),
      sub: `${metrics.inventoryStatus.lowStockCount} low-stock SKUs`,
      trend: metrics.inventoryTrendPct,
      spark: metrics.kpiSparklines.inventory,
      accent: "#3B82F6",
    },
    {
      label: "Production output",
      value: `${metrics.productionOverview.todayOutput} units`,
      sub: `${metrics.productionOverview.activeBatches} active batches`,
      trend: metrics.productionOverview.activeBatches > 0 ? 8.2 : 0,
      spark: metrics.kpiSparklines.production,
      accent: "#10B981",
    },
    {
      label: "Pending approvals",
      value: String(metrics.pendingApprovals.total),
      sub: `${metrics.pendingApprovals.purchases} GRN · ${metrics.pendingApprovals.documents} docs`,
      trend: metrics.pendingApprovals.total > 0 ? -metrics.pendingApprovals.total : 0,
      spark: metrics.kpiSparklines.sales.map((v) => v * 0.01),
      accent: "#F59E0B",
    },
    {
      label: "Open deliveries",
      value: String(metrics.deliveryPending),
      sub: "In transit & pending dispatch",
      trend: metrics.deliveryPending > 5 ? -4.5 : 2.1,
      spark: metrics.kpiSparklines.inventory,
      accent: "#8B5CF6",
    },
    {
      label: "Active leads",
      value: String(metrics.leadsCount),
      sub: `${metrics.leadConversionRatio}% conversion`,
      trend: metrics.leadConversionRatio,
      spark: metrics.kpiSparklines.sales,
      accent: "#EC4899",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.35 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="erp-kpi-card overflow-hidden p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {kpi.label}
              </p>
              <p className="mt-1.5 truncate text-lg font-semibold tracking-tight">{kpi.value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{kpi.sub}</p>
            </div>
            <TrendBadge trend={kpi.trend} />
          </div>
          <div className="mt-3 h-10 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpi.spark.map((v, idx) => ({ v, idx }))}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={kpi.accent}
                  strokeWidth={2}
                  dot={false}
                  animationDuration={800}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function TrendBadge({ trend }: { trend: number }) {
  const up = trend >= 0;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
        up ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-red-500/12 text-red-600 dark:text-red-400",
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" strokeWidth={ICON_STROKE} /> : <TrendingDown className="h-3 w-3" strokeWidth={ICON_STROKE} />}
      {trendLabel(trend)}
    </span>
  );
}

export function CommandCenterCharts({ metrics }: { metrics: CommandCenterMetrics }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="erp-kpi-card p-5"
      >
        <h3 className="text-sm font-semibold">Sales trends</h3>
        <p className="text-xs text-muted-foreground">Revenue vs procurement — last 6 months</p>
        <div className="mt-4 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.revenueByMonth}>
              <defs>
                <linearGradient id="g-sales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B68D40" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#B68D40" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="revenue" stroke="#B68D40" fill="url(#g-sales)" strokeWidth={2} />
              <Area type="monotone" dataKey="purchases" stroke="#3B82F6" fill="transparent" strokeWidth={2} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="erp-kpi-card p-5"
      >
        <h3 className="text-sm font-semibold">Inventory movement</h3>
        <p className="text-xs text-muted-foreground">Inbound vs outbound flow</p>
        <div className="mt-4 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.inventoryMovement}>
              <Area type="monotone" dataKey="inbound" stroke="#10B981" fill="#10B981" fillOpacity={0.12} strokeWidth={2} />
              <Area type="monotone" dataKey="outbound" stroke="#F59E0B" fill="transparent" strokeWidth={2} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="erp-kpi-card p-5 lg:col-span-2"
      >
        <h3 className="text-sm font-semibold">Revenue growth & procurement</h3>
        <div className="mt-4 h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.revenueByMonth}>
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#B68D40" fill="#B68D40" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="purchases" name="Procurement" stroke="#64748B" fill="#64748B" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="erp-kpi-card p-5"
      >
        <h3 className="text-sm font-semibold">Production analytics</h3>
        <div className="mt-4 space-y-3">
          {metrics.productionByStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground">No batch data yet</p>
          ) : (
            metrics.productionByStatus.map((p) => (
              <div key={p.status} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="capitalize text-muted-foreground">{p.status.toLowerCase().replace("_", " ")}</span>
                  <span className="font-medium">{p.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
                  <motion.div
                    className="h-full rounded-full bg-[#B68D40]"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, p.count * 15)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="erp-kpi-card p-5"
      >
        <h3 className="text-sm font-semibold">Procurement analytics</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <Row label="Vendors" value={String(metrics.procurement.vendorCount)} />
          <Row label="Month purchases" value={formatInr(metrics.procurement.monthPurchases)} />
          <Row label="Pending GRN" value={String(metrics.procurement.openGrn)} />
          <Row label="Awaiting approval" value={String(metrics.procurement.pendingApprovals)} />
        </dl>
      </motion.div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
