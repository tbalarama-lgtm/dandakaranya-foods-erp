"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Factory,
  Target,
  Cog,
  Gauge,
  TrendingUp,
  AlertTriangle,
  XCircle,
  Package,
  Layers,
  Users,
} from "lucide-react";
import type { ProductionDashboardMetrics } from "@/lib/production/types";
import { ProductionStatCard } from "@/components/production/production-stat-card";
import { ProductionExportButtons } from "@/components/production/production-export-buttons";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { PRODUCTION_PLANTS } from "@/lib/production/mock-data";

export function ProductionDashboardClient({ metrics }: { metrics: ProductionDashboardMetrics }) {
  const [plant, setPlant] = useState("All plants");
  const progress = Math.round((metrics.achievedToday / metrics.targetToday) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
          value={plant}
          onChange={(e) => setPlant(e.target.value)}
        >
          {PRODUCTION_PLANTS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <ProductionExportButtons filename="production-overview" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 2xl:grid-cols-10">
        <ProductionStatCard label="Production today" value={`${metrics.productionToday} kg`} icon={Factory} delay={0} />
        <ProductionStatCard label="Target vs achieved" value={`${progress}%`} sub={`${metrics.achievedToday}/${metrics.targetToday} kg`} icon={Target} accent="blue" delay={0.03} />
        <ProductionStatCard label="Active lines" value={metrics.activeLines} icon={Cog} accent="violet" delay={0.06} />
        <ProductionStatCard label="Machine util." value={`${metrics.machineUtilization}%`} icon={Gauge} accent="amber" delay={0.09} />
        <ProductionStatCard label="Efficiency" value={`${metrics.efficiency}%`} icon={TrendingUp} delay={0.12} />
        <ProductionStatCard label="Downtime" value={`${metrics.downtimeHours}h`} icon={AlertTriangle} accent="rose" delay={0.15} />
        <ProductionStatCard label="Rejected" value={metrics.rejectedUnits} icon={XCircle} accent="rose" delay={0.18} />
        <ProductionStatCard label="RM consumed" value={`${metrics.rawMaterialConsumption} kg`} icon={Package} accent="amber" delay={0.21} />
        <ProductionStatCard label="Active batches" value={metrics.activeBatches} icon={Layers} delay={0.24} />
        <ProductionStatCard label="Attendance" value={metrics.workerAttendance} icon={Users} accent="blue" delay={0.27} />
      </div>

      <GlassCard glow="emerald">
        <GlassCardBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">OEE (Overall Equipment Effectiveness)</p>
              <p className="text-3xl font-semibold text-primary">{metrics.oeeScore}%</p>
              <p className="text-xs text-muted-foreground">Availability × Performance × Quality — IoT placeholder</p>
            </div>
            <div className="h-3 w-full max-w-md rounded-full bg-muted sm:w-72">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400" style={{ width: `${metrics.oeeScore}%` }} />
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-1 text-xs text-muted-foreground">Daily target progress</p>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </GlassCardBody>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <GlassCard className="xl:col-span-2" glow="blue">
          <GlassCardHeader><h3 className="font-semibold">Production trend (shift-wise)</h3></GlassCardHeader>
          <GlassCardBody className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.productionTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="shift" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="planned" stroke="hsl(220 70% 50%)" name="Planned" strokeWidth={2} />
                <Line type="monotone" dataKey="actual" stroke="hsl(158 45% 42%)" name="Actual" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </GlassCardBody>
        </GlassCard>
        <GlassCard glow="violet">
          <GlassCardHeader><h3 className="font-semibold">Shift efficiency</h3></GlassCardHeader>
          <GlassCardBody className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.shiftAnalytics}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="shift" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="efficiency" fill="hsl(260 60% 55%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCardBody>
        </GlassCard>
        <GlassCard className="lg:col-span-2 xl:col-span-3" glow="amber">
          <GlassCardHeader><h3 className="font-semibold">Department output (kg)</h3></GlassCardHeader>
          <GlassCardBody className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.departmentOutput} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="output" fill="hsl(38 55% 52%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCardBody>
        </GlassCard>
      </div>
    </div>
  );
}
