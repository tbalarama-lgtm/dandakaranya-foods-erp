"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PerformanceReview } from "@/lib/hr/types";
import { MOCK_EMPLOYEES } from "@/lib/hr/mock-data";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";

export function PerformanceClient({ reviews }: { reviews: PerformanceReview[] }) {
  const chartData = reviews.map((r) => {
    const emp = MOCK_EMPLOYEES.find((e) => e.id === r.employeeId);
    return { name: emp?.name.split(" ")[0] ?? r.employeeId, kpi: r.kpiScore, productivity: r.productivity };
  });

  return (
    <div className="space-y-6">
      <GlassCard>
        <GlassCardHeader>
          <h3 className="font-semibold">KPI & productivity</h3>
          <p className="text-xs text-muted-foreground">Monthly appraisal — Apr 2026</p>
        </GlassCardHeader>
        <GlassCardBody className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="kpi" name="KPI %" fill="hsl(158 45% 42%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="productivity" name="Productivity" fill="hsl(260 60% 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCardBody>
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-2">
        {reviews.map((r) => {
          const emp = MOCK_EMPLOYEES.find((e) => e.id === r.employeeId);
          return (
            <GlassCard key={r.id}>
              <GlassCardBody>
                <div className="flex justify-between">
                  <p className="font-medium">{emp?.name}</p>
                  <span className="text-sm font-semibold text-primary">{r.rating}/5</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.period}</p>
                <p className="mt-3 text-sm text-muted-foreground">{r.managerReview}</p>
                <div className="mt-3 flex gap-4 text-xs">
                  <span>KPI: {r.kpiScore}%</span>
                  <span>Productivity: {r.productivity}%</span>
                </div>
              </GlassCardBody>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
