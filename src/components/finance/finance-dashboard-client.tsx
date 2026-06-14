"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Receipt,
  Landmark,
  Scale,
  ShoppingCart,
  Truck,
  Activity,
} from "lucide-react";
import type { FinanceDashboardMetrics } from "@/lib/finance/types";
import { FinanceStatCard } from "@/components/finance/finance-stat-card";
import { FinanceFiltersBar } from "@/components/finance/finance-filters";
import { FinanceExportButtons } from "@/components/finance/finance-export-buttons";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { formatInr } from "@/lib/utils";

const PIE_COLORS = ["#1d4e3a", "#2d6a4f", "#40916c", "#52b788", "#74c69d", "#95d5b2", "#b7e4c7"];

export function FinanceDashboardClient({ metrics }: { metrics: FinanceDashboardMetrics }) {
  const [branch, setBranch] = useState("All branches");
  const [period, setPeriod] = useState("mtd");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <FinanceFiltersBar branch={branch} onBranch={setBranch} period={period} onPeriod={setPeriod} />
        <FinanceExportButtons filename="finance-overview" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
        <FinanceStatCard label="Total revenue" value={formatInr(metrics.totalRevenue)} icon={TrendingUp} accent="emerald" delay={0} />
        <FinanceStatCard label="Total expenses" value={formatInr(metrics.totalExpenses)} icon={TrendingDown} accent="rose" delay={0.04} />
        <FinanceStatCard label="Net profit" value={formatInr(metrics.netProfit)} icon={Activity} accent="blue" delay={0.08} />
        <FinanceStatCard label="Outstanding" value={formatInr(metrics.outstandingPayments)} icon={CreditCard} accent="amber" delay={0.12} />
        <FinanceStatCard label="Receivables" value={formatInr(metrics.pendingReceivables)} icon={Receipt} accent="violet" delay={0.16} />
        <FinanceStatCard label="Cash flow" value={formatInr(metrics.monthlyCashFlow)} sub="This month" icon={Wallet} accent="emerald" delay={0.2} />
        <FinanceStatCard label="GST payable" value={formatInr(metrics.gstPayable)} icon={Scale} accent="amber" delay={0.24} />
        <FinanceStatCard label="Bank balance" value={formatInr(metrics.bankBalance)} icon={Landmark} accent="blue" delay={0.28} />
      </div>

      <GlassCard glow="emerald">
        <GlassCardBody className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <p className="text-sm font-medium">Financial health</p>
            <p className="text-3xl font-semibold text-primary">{metrics.healthScore}/100</p>
            <p className="text-sm text-muted-foreground">{metrics.healthLabel} — liquidity & margin within target</p>
          </div>
          <div className="h-3 w-full max-w-md overflow-hidden rounded-full bg-muted sm:w-64">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all"
              style={{ width: `${metrics.healthScore}%` }}
            />
          </div>
        </GlassCardBody>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <GlassCard className="xl:col-span-2" delay={0.1} glow="blue">
          <GlassCardHeader>
            <h3 className="font-semibold">Revenue & profit trends</h3>
          </GlassCardHeader>
          <GlassCardBody className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(158 45% 42%)" strokeWidth={2} name="Revenue" />
                <Line type="monotone" dataKey="expenses" stroke="hsl(0 72% 51%)" strokeWidth={2} name="Expenses" />
                <Line type="monotone" dataKey="profit" stroke="hsl(220 70% 50%)" strokeWidth={2} name="Profit" />
              </LineChart>
            </ResponsiveContainer>
          </GlassCardBody>
        </GlassCard>

        <GlassCard delay={0.15} glow="violet">
          <GlassCardHeader>
            <h3 className="font-semibold">Expense breakdown</h3>
          </GlassCardHeader>
          <GlassCardBody className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.expenseBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label>
                  {metrics.expenseBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
              </PieChart>
            </ResponsiveContainer>
          </GlassCardBody>
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard delay={0.2} glow="emerald">
          <GlassCardHeader className="flex flex-row items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Purchase vs sales</h3>
          </GlassCardHeader>
          <GlassCardBody className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.purchaseVsSales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
                <Bar dataKey="sales" name="Sales" fill="hsl(158 45% 42%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" name="Purchases" fill="hsl(38 55% 52%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCardBody>
        </GlassCard>

        <GlassCard delay={0.25} glow="blue">
          <GlassCardHeader className="flex flex-row items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Cash flow</h3>
          </GlassCardHeader>
          <GlassCardBody className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.cashFlowSeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
                <Area type="monotone" dataKey="inflow" stackId="1" stroke="hsl(158 45% 42%)" fill="hsl(158 45% 42% / 0.25)" name="Inflow" />
                <Area type="monotone" dataKey="outflow" stackId="2" stroke="hsl(0 72% 51%)" fill="hsl(0 72% 51% / 0.2)" name="Outflow" />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCardBody>
        </GlassCard>
      </div>
    </div>
  );
}
