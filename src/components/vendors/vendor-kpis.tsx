import { Building2, Clock, IndianRupee, ShieldAlert, Star, TrendingUp } from "lucide-react";
import type { VendorAnalytics } from "@/lib/vendor-types";
import { formatInr } from "@/lib/utils";

export function VendorKpis({ analytics }: { analytics: VendorAnalytics }) {
  const cards = [
    {
      label: "Total vendors",
      value: String(analytics.totalVendors),
      sub: `${analytics.activeVendors} active · ${analytics.preferredVendors} preferred`,
      icon: Building2,
      accent: "text-[#B68D40]",
    },
    {
      label: "Procurement spend",
      value: formatInr(analytics.totalSpend),
      sub: `${analytics.pendingApproval} pending approval`,
      icon: IndianRupee,
      accent: "text-emerald-600",
    },
    {
      label: "Outstanding payables",
      value: formatInr(analytics.outstandingPayables),
      sub: `${formatInr(analytics.overduePayables)} overdue`,
      icon: Clock,
      accent: "text-amber-700",
    },
    {
      label: "Avg quality score",
      value: `${analytics.avgQualityScore.toFixed(1)}%`,
      sub: `${analytics.avgRejectionRate.toFixed(1)}% rejection · ${analytics.avgDeliveryScore.toFixed(1)}% delivery`,
      icon: Star,
      accent: "text-violet-600",
    },
    {
      label: "Compliance alerts",
      value: String(analytics.complianceAlerts),
      sub: `${analytics.expiringContracts} contracts expiring`,
      icon: ShieldAlert,
      accent: "text-red-600",
    },
    {
      label: "Open RFQs",
      value: String(analytics.openRfqs),
      sub: `${analytics.pendingGrns} GRNs pending`,
      icon: TrendingUp,
      accent: "text-sky-600",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="erp-kpi-card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <p className={`mt-1 text-xl font-bold ${c.accent}`}>{c.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
            </div>
            <c.icon className={`h-5 w-5 ${c.accent} opacity-70`} />
          </div>
        </div>
      ))}
    </div>
  );
}
