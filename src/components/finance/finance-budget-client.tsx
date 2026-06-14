"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BudgetLine } from "@/lib/finance/types";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { formatInr } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function FinanceBudgetClient({ budget }: { budget: BudgetLine[] }) {
  return (
    <div className="space-y-6">
      <GlassCard>
        <GlassCardHeader>
          <h3 className="font-semibold">Variance analysis — FY 2026</h3>
        </GlassCardHeader>
        <GlassCardBody className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={budget}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="department" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
              <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
              <Legend />
              <Bar dataKey="budgeted" name="Budget" fill="hsl(220 70% 50%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Actual" fill="hsl(158 45% 42%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="forecast" name="Forecast" fill="hsl(260 60% 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCardBody>
      </GlassCard>
      <div className="grid gap-4 md:grid-cols-2">
        {budget.map((b) => {
          const variance = ((b.actual - b.budgeted) / b.budgeted) * 100;
          const over = variance > 5;
          return (
            <GlassCard key={b.id}>
              <GlassCardBody>
                <div className="flex items-center justify-between">
                  <p className="font-medium">{b.department}</p>
                  <Badge variant={over ? "danger" : "success"}>{variance.toFixed(1)}%</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Budget {formatInr(b.budgeted)} · Actual {formatInr(b.actual)}
                </p>
              </GlassCardBody>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
