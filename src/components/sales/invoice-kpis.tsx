"use client";

import { DollarSign, AlertTriangle, TrendingUp, Clock, Percent, Wallet } from "lucide-react";
import type { InvoiceAnalytics } from "@/lib/invoice-types";
import { formatInr } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";

export function InvoiceKpis({ analytics }: { analytics: InvoiceAnalytics }) {
  const cards = [
    { label: "Total revenue", value: formatInr(analytics.totalRevenue), icon: DollarSign },
    { label: "Collected", value: formatInr(analytics.collected), icon: Wallet },
    { label: "Outstanding", value: formatInr(analytics.outstanding), icon: TrendingUp },
    { label: "Overdue", value: `${analytics.overdueCount} · ${formatInr(analytics.overdueAmount)}`, icon: AlertTriangle },
    { label: "Collection rate", value: `${analytics.collectionRate}%`, icon: Percent },
    { label: "Avg days to pay", value: `${analytics.avgDaysToPay}d`, icon: Clock },
    { label: "Est. margin", value: `${analytics.marginEstimate}%`, icon: Percent },
    { label: "Receivables forecast", value: formatInr(analytics.forecastReceivables), icon: TrendingUp },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="erp-kpi-card flex items-start gap-3 p-4">
          <div className="rounded-lg bg-[#B68D40]/12 p-2">
            <c.icon className="h-4 w-4 text-[#967235]" strokeWidth={ICON_STROKE} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className="mt-0.5 text-lg font-bold">{c.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
