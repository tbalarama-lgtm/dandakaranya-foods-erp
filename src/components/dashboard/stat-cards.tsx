"use client";

import { IndianRupee, Package, ShoppingCart, Truck, Users, AlertCircle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatInr, cn } from "@/lib/utils";

const icons = [ShoppingCart, Truck, AlertCircle, Package, Users];

const accents = [
  "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  "from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-600 dark:text-blue-400",
  "from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400",
  "from-violet-500/10 to-violet-500/5 border-violet-500/20 text-violet-600 dark:text-violet-400",
  "from-rose-500/10 to-rose-500/5 border-rose-500/20 text-rose-600 dark:text-rose-400",
];

export function StatCards({
  stats,
}: {
  stats: {
    totalSales: number;
    totalPurchases: number;
    pendingPayments: number;
    inventoryValue: number;
    leadsCount: number;
    monthSales: number;
  };
}) {
  const items = [
    { label: "Total sales", value: formatInr(stats.totalSales), sub: `${formatInr(stats.monthSales)} this month` },
    { label: "Total purchases", value: formatInr(stats.totalPurchases), sub: "Procurement spend" },
    { label: "Pending payments", value: formatInr(stats.pendingPayments), sub: "Receivables & payables" },
    { label: "Inventory value", value: formatInr(stats.inventoryValue), sub: "At cost price" },
    { label: "Active leads", value: String(stats.leadsCount), sub: "Pipeline (excl. lost)" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item, i) => {
        const Icon = icons[i] ?? IndianRupee;
        return (
          <Card key={item.label} className="overflow-hidden transition hover:shadow-erp-lg">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.sub}</p>
                </div>
                <div
                  className={cn(
                    "flex w-14 items-center justify-center border-l bg-gradient-to-b",
                    accents[i],
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
