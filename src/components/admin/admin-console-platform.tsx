"use client";

import Link from "next/link";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { AdminConsoleAnalytics } from "@/lib/admin-console-metrics";
import {
  Activity,
  ArrowRight,
  Building2,
  KeyRound,
  Plug,
  ScrollText,
  Settings,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_COLORS = ["#B68D40", "#1E3A5F", "#059669", "#7C3AED", "#DC2626"];

export function AdminConsolePlatform({ analytics }: { analytics: AdminConsoleAnalytics }) {
  const { kpis, recentActivity, roleDistribution } = analytics;

  const healthColor =
    kpis.systemHealth === "healthy"
      ? "text-emerald-500"
      : kpis.systemHealth === "degraded"
        ? "text-amber-500"
        : "text-red-500";

  const consoleLinks = [
    { href: "/users", label: "User management", desc: "Invite, deactivate, and assign roles", icon: UserCog },
    { href: "/activity", label: "Activity & audit logs", desc: "Full audit trail with CSV export", icon: ScrollText },
    { href: "/company", label: "Company profile", desc: "Legal entity, GSTIN, and branding", icon: Building2 },
    { href: "/settings", label: "System settings", desc: "Security, backups, and preferences", icon: Settings },
    { href: "/settings/integrations", label: "Integrations", desc: "API connectors and webhooks", icon: Plug },
    { href: "/users", label: "Roles & permissions", desc: "RBAC matrix (5 enterprise roles)", icon: KeyRound },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <div className="erp-kpi-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Active users</p>
          <p className="mt-1 text-xl font-bold text-[#B68D40]">{kpis.activeUsers}</p>
        </div>
        <div className="erp-kpi-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Administrators</p>
          <p className="mt-1 text-xl font-bold text-[#B68D40]">{kpis.adminUsers}</p>
        </div>
        <div className="erp-kpi-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Activity today</p>
          <p className="mt-1 text-xl font-bold text-[#B68D40]">{kpis.activityToday}</p>
          <Activity className="mt-2 h-5 w-5 text-muted-foreground" />
        </div>
        <div className="erp-kpi-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">System health</p>
          <p className={cn("mt-1 text-xl font-bold capitalize", healthColor)}>{kpis.systemHealth}</p>
        </div>
        <div className="erp-kpi-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Integrations off</p>
          <p className="mt-1 text-xl font-bold text-[#B68D40]">{kpis.pendingIntegrations}</p>
        </div>
        <div className="erp-kpi-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last backup</p>
          <p className="mt-1 text-sm font-semibold text-[#B68D40]">{kpis.backupStatus}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Role distribution</h3>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={roleDistribution} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={80}>
                  {roleDistribution.map((_, i) => (
                    <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Admin console</h3>
          <ul className="mt-4 space-y-2">
            {consoleLinks.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5 transition hover:border-[#B68D40]/40 hover:bg-[#B68D40]/5"
                >
                  <l.icon className="h-4 w-4 shrink-0 text-[#B68D40]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{l.label}</p>
                    <p className="text-xs text-muted-foreground">{l.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="erp-kpi-card overflow-hidden">
        <div className="border-b border-border/50 px-5 py-4">
          <h3 className="text-sm font-semibold">Recent system activity</h3>
        </div>
        <div className="divide-y divide-border/30">
          {recentActivity.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <div>
                <p className="font-medium">{a.action}</p>
                <p className="text-xs text-muted-foreground">
                  {a.entity} · {a.user}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{a.time}</span>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <p className="px-5 py-8 text-center text-muted-foreground">No activity logged yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
