"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MOCK_INVENTORY_VALUATION } from "@/lib/finance/mock-data";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { FinanceStatCard } from "@/components/finance/finance-stat-card";
import { Package, Boxes, TrendingDown } from "lucide-react";
import { formatInr } from "@/lib/utils";

export function FinanceInventoryClient() {
  const v = MOCK_INVENTORY_VALUATION;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FinanceStatCard label="Total valuation" value={formatInr(v.totalValue)} icon={Package} accent="emerald" />
        <FinanceStatCard label="Raw materials" value={formatInr(v.rawMaterials)} icon={Boxes} accent="blue" />
        <FinanceStatCard label="Finished goods" value={formatInr(v.finishedGoods)} icon={Package} accent="violet" />
        <FinanceStatCard label="Stock movement impact" value={formatInr(v.movementImpact)} icon={TrendingDown} accent="rose" />
      </div>
      <GlassCard>
        <GlassCardHeader>
          <h3 className="font-semibold">Product profitability</h3>
        </GlassCardHeader>
        <GlassCardBody className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={v.topProducts} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(n) => `₹${(n / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
              <Tooltip formatter={(val) => formatInr(Number(val ?? 0))} />
              <Bar dataKey="revenue" name="Revenue" fill="hsl(158 45% 42%)" radius={[0, 4, 4, 0]} />
              <Bar dataKey="cost" name="Cost" fill="hsl(38 55% 52%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}
