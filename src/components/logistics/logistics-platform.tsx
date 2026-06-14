"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LogisticsHubAnalytics } from "@/lib/logistics-metrics";
import { ArrowRight, MapPin, Package, Route, Truck, Warehouse } from "lucide-react";

export function LogisticsPlatform({ analytics }: { analytics: LogisticsHubAnalytics }) {
  const { kpis, dispatchTrend, recentDispatches } = analytics;

  const kpiCards = [
    { label: "Active warehouses", value: String(kpis.activeWarehouses), icon: Warehouse },
    { label: "Pending dispatch", value: String(kpis.pendingDispatch), icon: Package },
    { label: "In transit", value: String(kpis.inTransit), icon: Truck },
    { label: "Open transfers", value: String(kpis.openTransfers), icon: Route },
    { label: "Dock appointments", value: String(kpis.dockAppointments), icon: MapPin },
    { label: "On-time delivery", value: `${kpis.onTimeRate}%`, icon: Truck },
  ];

  const quickLinks = [
    { href: "/warehouses/dispatch", label: "Pick · pack · dispatch" },
    { href: "/warehouses/transfers", label: "Inter-warehouse transfers" },
    { href: "/warehouses", label: "Warehouse network" },
    { href: "/branches", label: "Branches & distribution" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpiCards.map((c) => (
          <div key={c.label} className="erp-kpi-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-xl font-bold text-[#B68D40]">{c.value}</p>
            <c.icon className="mt-2 h-5 w-5 text-muted-foreground" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Dispatch trend (7 days)</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dispatchTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="dispatched" fill="#B68D40" radius={[4, 4, 0, 0]} />
                <Bar dataKey="delivered" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Logistics operations</h3>
          <ul className="mt-4 space-y-2">
            {quickLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5 text-sm transition hover:border-[#B68D40]/40 hover:bg-[#B68D40]/5"
                >
                  {l.label}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="erp-kpi-card overflow-hidden">
        <div className="border-b border-border/50 px-5 py-4">
          <h3 className="text-sm font-semibold">Recent dispatches</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Dispatch #</th>
                <th className="px-5 py-3">Warehouse</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Lines</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentDispatches.map((r) => (
                <tr key={r.id} className="border-b border-border/30 last:border-0">
                  <td className="px-5 py-3 font-medium">{r.reference}</td>
                  <td className="px-5 py-3">{r.warehouse}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.status.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3">{r.lines}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.date}</td>
                </tr>
              ))}
              {recentDispatches.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    No dispatches yet. Create a sales order to start fulfillment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
