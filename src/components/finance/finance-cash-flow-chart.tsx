"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FinanceDashboardMetrics } from "@/lib/finance/types";
import { formatInr } from "@/lib/utils";

export function FinanceCashFlowChart({ data }: { data: FinanceDashboardMetrics["cashFlowSeries"] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" />
        <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
        <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
        <Area type="monotone" dataKey="inflow" stroke="hsl(158 45% 42%)" fill="hsl(158 45% 42% / 0.3)" name="Inflow" />
        <Area type="monotone" dataKey="outflow" stroke="hsl(0 72% 51%)" fill="hsl(0 72% 51% / 0.25)" name="Outflow" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
