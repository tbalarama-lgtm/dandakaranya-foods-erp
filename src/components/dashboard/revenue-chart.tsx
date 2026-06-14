"use client";

import { formatInr } from "@/lib/utils";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RevenueChart({ data }: { data: { month: string; revenue: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly revenue</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c9a067" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#c9a067" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
            <Area type="monotone" dataKey="revenue" stroke="#c9a067" fill="url(#gold)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
