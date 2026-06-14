"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MOCK_PAYROLL_FINANCE } from "@/lib/finance/mock-data";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { FinanceStatCard } from "@/components/finance/finance-stat-card";
import { FinanceExportButtons } from "@/components/finance/finance-export-buttons";
import { Users, Gift, Minus } from "lucide-react";
import { formatInr } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function FinancePayrollClient() {
  const p = MOCK_PAYROLL_FINANCE;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/hr/payroll">Open HR payroll</Link>
        </Button>
        <FinanceExportButtons filename="payroll-finance" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FinanceStatCard label="Monthly payroll" value={formatInr(p.monthlyPayroll)} icon={Users} accent="emerald" />
        <FinanceStatCard label="Bonus & incentives" value={formatInr(p.bonusPaid)} icon={Gift} accent="violet" />
        <FinanceStatCard label="Deductions" value={formatInr(p.deductions)} icon={Minus} accent="rose" />
      </div>
      <GlassCard>
        <GlassCardHeader>
          <h3 className="font-semibold">Payroll expense trend</h3>
        </GlassCardHeader>
        <GlassCardBody className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={p.history}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
              <Bar dataKey="amount" fill="hsl(158 45% 42%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}
