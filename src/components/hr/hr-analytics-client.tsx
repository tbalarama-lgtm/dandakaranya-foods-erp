"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getHrDashboardMetrics } from "@/lib/hr/mock-data";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { HrStatCard } from "@/components/hr/hr-stat-card";
import { TrendingUp, Users, Wallet } from "lucide-react";

export function HrAnalyticsClient() {
  const m = getHrDashboardMetrics();
  const turnover = [
    { month: "Jan", rate: 2.1 },
    { month: "Feb", rate: 1.8 },
    { month: "Mar", rate: 2.4 },
    { month: "Apr", rate: 1.5 },
    { month: "May", rate: 1.2 },
  ];
  const cost = m.hiringStats.map((h) => ({ month: h.month, cost: h.hires * 45000 }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <HrStatCard label="Headcount" value={m.totalEmployees} icon={Users} accent="emerald" />
        <HrStatCard label="Attrition (YTD)" value="1.8%" icon={TrendingUp} accent="amber" />
        <HrStatCard label="Payroll cost index" value="₹4.2L" icon={Wallet} accent="violet" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <GlassCardHeader>
            <h3 className="font-semibold">Attendance trend</h3>
          </GlassCardHeader>
          <GlassCardBody className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={m.attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="present" stroke="hsl(158 45% 42%)" fill="hsl(158 45% 42% / 0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCardBody>
        </GlassCard>
        <GlassCard>
          <GlassCardHeader>
            <h3 className="font-semibold">Hiring cost estimate</h3>
          </GlassCardHeader>
          <GlassCardBody className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cost}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="cost" fill="hsl(260 60% 55%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCardBody>
        </GlassCard>
      </div>
      <GlassCard>
        <GlassCardHeader>
          <h3 className="font-semibold">Multi-branch overview</h3>
        </GlassCardHeader>
        <GlassCardBody>
          <div className="grid gap-3 sm:grid-cols-3">
            {["Sukma HQ", "Raipur", "Mumbai"].map((b) => (
              <div key={b} className="rounded-xl border p-4">
                <p className="font-medium">{b}</p>
                <p className="text-2xl font-semibold">{b === "Sukma HQ" ? 9 : b === "Raipur" ? 1 : 1}</p>
                <p className="text-xs text-muted-foreground">Active employees</p>
              </div>
            ))}
          </div>
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}
