"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { VendorFormDialog } from "@/components/vendors/add-vendor-dialog";
import { VendorFilters } from "@/components/vendors/vendor-filters";
import { VendorKpis } from "@/components/vendors/vendor-kpis";
import { VendorTable } from "@/components/vendors/vendor-table";
import { EmptyState } from "@/components/shared/empty-state";
import type { VendorAnalytics, VendorListDto } from "@/lib/vendor-types";
import { VENDOR_CLASSIFICATION_LABELS } from "@/lib/vendor-types";
import { formatInr } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CLASS_COLORS = ["#B68D40", "#1E3A5F", "#059669", "#7C3AED", "#64748B"];

export function VendorPlatform({
  vendors,
  analytics,
}: {
  vendors: VendorListDto[];
  analytics: VendorAnalytics;
}) {
  const classChart = analytics.byClassification.map((c) => ({
    name: VENDOR_CLASSIFICATION_LABELS[c.classification],
    value: c.spend,
    count: c.count,
  }));

  return (
    <div className="space-y-6">
      <VendorKpis analytics={analytics} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="erp-kpi-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold">Procurement spend trend</h3>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.spendTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatInr(Number(v))} />
                <Bar dataKey="spend" fill="#B68D40" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Spend by classification</h3>
          <div className="mt-4 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={classChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                  {classChart.map((_, i) => (
                    <Cell key={i} fill={CLASS_COLORS[i % CLASS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatInr(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {analytics.topVendors.slice(0, 3).map((v, i) => (
              <li key={v.id} className="flex justify-between">
                <Link href={`/vendors/${v.id}`} className="hover:text-[#B68D40]">
                  {i + 1}. {v.name}
                </Link>
                <span className="font-semibold">{formatInr(v.spend)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Suspense fallback={null}>
        <VendorFilters />
      </Suspense>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{vendors.length} vendor(s)</p>
        <div className="flex gap-2">
          <Link
            href="/procurement"
            className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            Procurement dashboard
          </Link>
          <Link
            href="/procurement/rfq"
            className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            RFQ management
          </Link>
          <VendorFormDialog />
        </div>
      </div>

      {vendors.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No vendors match your filters"
          description="Adjust filters or add a new supplier to get started."
        />
      ) : (
        <VendorTable vendors={vendors} />
      )}
    </div>
  );
}
