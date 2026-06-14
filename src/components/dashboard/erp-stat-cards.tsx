"use client";

import {
  IndianRupee,
  Package,
  ShoppingCart,
  Truck,
  Users,
  AlertCircle,
  Factory,
  ClipboardList,
  TrendingUp,
  Percent,
} from "lucide-react";
import { GlassCard } from "@/components/dashboard/glass-card";
import { formatInr, cn } from "@/lib/utils";

const icons = [ShoppingCart, Truck, ClipboardList, Package, Factory, Users, TrendingUp, Percent, AlertCircle];

const accents = [
  { bar: "from-[#B68D40]/70 to-[#967235]/40", icon: "text-[#071226]", glow: "amber" as const },
  { bar: "from-[#102544]/80 to-[#08182F]/60", icon: "text-white", glow: "blue" as const },
  { bar: "from-emerald-400 to-emerald-600", icon: "text-white", glow: "emerald" as const },
  { bar: "from-violet-400 to-violet-600", icon: "text-white", glow: "violet" as const },
  { bar: "from-orange-400 to-orange-600", icon: "text-white", glow: "amber" as const },
  { bar: "from-rose-400 to-rose-600", icon: "text-white", glow: "violet" as const },
  { bar: "from-indigo-400 to-indigo-600", icon: "text-white", glow: "violet" as const },
  { bar: "from-teal-400 to-teal-600", icon: "text-white", glow: "emerald" as const },
  { bar: "from-amber-400 to-amber-600", icon: "text-white", glow: "amber" as const },
];

export function ErpStatCards({
  stats,
}: {
  stats: {
    totalSales: number;
    totalPurchases: number;
    pendingPayments: number;
    pendingOrders: number;
    inventoryValue: number;
    productionOverview: { activeBatches: number; todayOutput: number };
    leadsCount: number;
    leadConversionRatio: number;
    revenueYtd: number;
    lowStockCount: number;
  };
}) {
  const items = [
    { label: "Total sales", value: formatInr(stats.totalSales), sub: "Lifetime revenue" },
    { label: "Purchase summary", value: formatInr(stats.totalPurchases), sub: "Procurement spend" },
    { label: "Pending orders", value: String(stats.pendingOrders), sub: "Open sales orders" },
    { label: "Inventory value", value: formatInr(stats.inventoryValue), sub: "At cost price" },
    {
      label: "Production",
      value: `${stats.productionOverview.activeBatches} active`,
      sub: `${stats.productionOverview.todayOutput} units today`,
    },
    { label: "Active leads", value: String(stats.leadsCount), sub: "CRM pipeline" },
    { label: "Revenue YTD", value: formatInr(stats.revenueYtd), sub: "Year to date" },
    { label: "Lead conversion", value: `${stats.leadConversionRatio}%`, sub: "Converted / total" },
    { label: "Low stock SKUs", value: String(stats.lowStockCount), sub: "Needs replenishment" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      {items.map((item, i) => {
        const Icon = icons[i] ?? IndianRupee;
        const accent = accents[i] ?? accents[0];
        return (
          <GlassCard key={item.label} delay={i * 0.06} glow={accent.glow} className="erp-kpi-card min-h-[112px] border-border/70">
            <div className="flex items-stretch">
              <div className="flex flex-1 flex-col p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.sub}</p>
              </div>
              <div className="relative flex w-[3.25rem] flex-col items-center justify-center overflow-hidden border-l border-border/40">
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-b opacity-90 transition-opacity group-hover:opacity-100",
                    accent.bar,
                  )}
                />
                <Icon className={cn("relative z-10 h-5 w-5 drop-shadow-sm", accent.icon)} strokeWidth={1.75} />
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
