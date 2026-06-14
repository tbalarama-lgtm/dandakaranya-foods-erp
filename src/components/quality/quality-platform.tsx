"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { QualityHubAnalytics } from "@/lib/quality-metrics";
import { ArrowRight, ClipboardCheck, FlaskConical, ShieldAlert, ShieldCheck } from "lucide-react";

export function QualityPlatform({ analytics }: { analytics: QualityHubAnalytics }) {
  const { kpis, inspectionTrend, recentInspections } = analytics;

  const kpiCards = [
    { label: "Pending inspections", value: String(kpis.pendingInspections), icon: ClipboardCheck },
    { label: "QC holds", value: String(kpis.qcHolds), icon: ShieldAlert, alert: kpis.qcHolds > 0 },
    { label: "Passed today", value: String(kpis.passedToday), icon: ShieldCheck },
    { label: "Failed this week", value: String(kpis.failedThisWeek), icon: FlaskConical },
    { label: "Compliance gaps", value: String(kpis.openCompliance), icon: ShieldAlert },
    { label: "QC pass rate", value: `${kpis.batchQcRate}%`, icon: ShieldCheck },
  ];

  const quickLinks = [
    { href: "/procurement/grn", label: "GRN & incoming QC" },
    { href: "/production/quality", label: "Production QC" },
    { href: "/production/batches", label: "Batch traceability" },
    { href: "/production/logs", label: "Production logs" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpiCards.map((c) => (
          <div key={c.label} className={`erp-kpi-card p-4 ${c.alert ? "border-amber-500/40" : ""}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-xl font-bold text-[#B68D40]">{c.value}</p>
            <c.icon className="mt-2 h-5 w-5 text-muted-foreground" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Inspection trend (7 days)</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={inspectionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="passed" stackId="1" stroke="#059669" fill="#05966933" />
                <Area type="monotone" dataKey="failed" stackId="2" stroke="#DC2626" fill="#DC262633" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Quality workflows</h3>
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
          <h3 className="text-sm font-semibold">Recent inspections</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Inspector</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentInspections.map((r) => (
                <tr key={r.id} className="border-b border-border/30 last:border-0">
                  <td className="px-5 py-3 font-medium">{r.reference}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.type}</td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        r.status === "PASS"
                          ? "text-emerald-600"
                          : r.status === "FAIL"
                            ? "text-red-600"
                            : "text-amber-600"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">{r.inspector}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.date}</td>
                </tr>
              ))}
              {recentInspections.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    No inspections recorded yet. Receive a GRN to start QC.
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
