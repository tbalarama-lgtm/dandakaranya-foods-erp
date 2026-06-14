"use client";

import { GlassCard } from "@/components/dashboard/glass-card";
import { formatInr } from "@/lib/utils";
import { CreditCard, Receipt, Truck, Users } from "lucide-react";

const metrics = [
  { key: "pending", label: "Pending payments", icon: CreditCard, glow: "amber" as const },
  { key: "expenses", label: "Monthly expenses", icon: Receipt, glow: "violet" as const },
  { key: "delivery", label: "Delivery in progress", icon: Truck, glow: "blue" as const },
  { key: "team", label: "Team (active)", icon: Users, glow: "emerald" as const },
] as const;

export function QuickMetrics({
  pendingPayments,
  expensesMonth,
  deliveryPending,
  employeesActive,
}: {
  pendingPayments: number;
  expensesMonth: number;
  deliveryPending: number;
  employeesActive: number;
}) {
  const values: Record<(typeof metrics)[number]["key"], string> = {
    pending: formatInr(pendingPayments),
    expenses: formatInr(expensesMonth),
    delivery: `${deliveryPending} orders`,
    team: `${employeesActive} employees`,
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m, i) => {
        const Icon = m.icon;
        return (
          <GlassCard key={m.key} delay={0.35 + i * 0.05} glow={m.glow}>
            <div className="flex items-center gap-4 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-white/30">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-lg font-semibold tracking-tight">{values[m.key]}</p>
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
