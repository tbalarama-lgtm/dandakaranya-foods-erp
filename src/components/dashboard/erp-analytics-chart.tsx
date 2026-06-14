"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { formatInr } from "@/lib/utils";

export function ErpAnalyticsChart({
  data,
}: {
  data: { month: string; revenue: number; purchases: number }[];
}) {
  return (
    <GlassCard delay={0.4} glow="emerald" className="h-full">
      <GlassCardHeader className="flex flex-row items-center justify-between border-0">
        <div>
          <h3 className="text-base font-semibold">Revenue analytics</h3>
          <p className="text-xs text-muted-foreground">Sales vs purchases — last 6 months</p>
        </div>
      </GlassCardHeader>
      <GlassCardBody className="h-[300px] pt-0">
        <ResponsiveContainer width="100%" height="100%" minHeight={260}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGlass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(158 45% 42%)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="hsl(158 45% 42%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="purGlass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(220 70% 55%)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(220 70% 55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => `₹${(Number(v) / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid hsl(var(--border) / 0.5)",
                background: "hsl(var(--card) / 0.9)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 8px 32px rgb(0 0 0 / 0.12)",
              }}
              formatter={(v) => formatInr(Number(v ?? 0))}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Sales"
              stroke="hsl(158 45% 42%)"
              strokeWidth={2}
              fill="url(#revGlass)"
            />
            <Area
              type="monotone"
              dataKey="purchases"
              name="Purchases"
              stroke="hsl(220 70% 55%)"
              strokeWidth={2}
              fill="url(#purGlass)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </GlassCardBody>
    </GlassCard>
  );
}
