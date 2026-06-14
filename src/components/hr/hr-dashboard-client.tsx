"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  UserPlus,
  UserCheck,
  UserX,
  Users,
  CalendarClock,
  Banknote,
  Cake,
  AlertTriangle,
} from "lucide-react";
import { HrStatCard } from "@/components/hr/hr-stat-card";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import type { HrDashboardMetrics } from "@/lib/hr/types";
import { Button } from "@/components/ui/button";

const PIE_COLORS = ["#2d6a4f", "#40916c", "#52b788", "#74c69d", "#95d5b2", "#b7e4c7", "#1d3557", "#457b9d"];

export function HrDashboardClient({ metrics }: { metrics: HrDashboardMetrics }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <HrStatCard label="Total employees" value={metrics.totalEmployees} icon={Users} accent="emerald" delay={0} />
        <HrStatCard label="Present today" value={metrics.presentToday} icon={UserCheck} accent="blue" delay={0.05} />
        <HrStatCard label="Absent today" value={metrics.absentToday} icon={UserX} accent="rose" delay={0.1} />
        <HrStatCard label="New joinees" value={metrics.newJoinees} sub="YTD 2026" icon={UserPlus} accent="violet" delay={0.15} />
        <HrStatCard label="Pending leaves" value={metrics.pendingLeaves} icon={CalendarClock} accent="amber" delay={0.2} />
        <HrStatCard label="Payroll" value="Active" sub={metrics.payrollStatus} icon={Banknote} accent="emerald" delay={0.25} />
        <HrStatCard label="Birthdays" value={metrics.upcomingBirthdays.length} sub="Upcoming" icon={Cake} accent="violet" delay={0.3} />
        <HrStatCard label="Perf. alerts" value={metrics.performanceAlerts} icon={AlertTriangle} accent="rose" delay={0.35} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <GlassCard delay={0.2} glow="blue" className="xl:col-span-2">
          <GlassCardHeader>
            <h3 className="font-semibold">Attendance trends</h3>
            <p className="text-xs text-muted-foreground">Present vs absent — this week</p>
          </GlassCardHeader>
          <GlassCardBody className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="present" name="Present" stroke="hsl(158 45% 42%)" strokeWidth={2} />
                <Line type="monotone" dataKey="absent" name="Absent" stroke="hsl(0 72% 51%)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </GlassCardBody>
        </GlassCard>

        <GlassCard delay={0.25} glow="emerald">
          <GlassCardHeader>
            <h3 className="font-semibold">By department</h3>
          </GlassCardHeader>
          <GlassCardBody className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.departmentDistribution} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {metrics.departmentDistribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </GlassCardBody>
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard delay={0.3} glow="violet">
          <GlassCardHeader>
            <h3 className="font-semibold">Monthly hiring</h3>
          </GlassCardHeader>
          <GlassCardBody className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.hiringStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="hires" name="Hires" fill="hsl(260 60% 55%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCardBody>
        </GlassCard>

        <GlassCard delay={0.35} glow="amber">
          <GlassCardHeader className="flex flex-row items-center justify-between">
            <h3 className="font-semibold">Quick actions</h3>
          </GlassCardHeader>
          <GlassCardBody className="grid gap-2 sm:grid-cols-2">
            {[
              { href: "/hr/employees/new", label: "Add employee" },
              { href: "/hr/leave", label: "Review leaves" },
              { href: "/hr/payroll", label: "Run payroll" },
              { href: "/hr/recruitment", label: "Recruitment board" },
            ].map((a) => (
              <Button key={a.href} asChild variant="outline" className="glass-button h-auto justify-start py-3">
                <Link href={a.href}>{a.label}</Link>
              </Button>
            ))}
            <div className="sm:col-span-2 mt-2 rounded-xl border border-border/50 bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground">Upcoming birthdays</p>
              <ul className="mt-2 space-y-1 text-sm">
                {metrics.upcomingBirthdays.map((b) => (
                  <li key={b.name} className="flex justify-between">
                    <span>{b.name}</span>
                    <span className="text-muted-foreground">{b.date}</span>
                  </li>
                ))}
              </ul>
            </div>
          </GlassCardBody>
        </GlassCard>
      </div>
    </div>
  );
}
