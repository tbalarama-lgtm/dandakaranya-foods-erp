"use client";

import { Suspense } from "react";
import { Users } from "lucide-react";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { CustomerExportMenu, CustomerTable } from "@/components/customers/customer-table";
import { CustomerFilters } from "@/components/customers/customer-filters";
import { CustomerKpis } from "@/components/customers/customer-kpis";
import { EmptyState } from "@/components/shared/empty-state";
import type { CustomerAnalytics } from "@/lib/customer-types";
import type { CustomerListDto } from "@/lib/customer-types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CUSTOMER_SEGMENT_LABELS } from "@/lib/customer-types";
import { formatInr } from "@/lib/utils";

export function CustomerPlatform({
  customers,
  analytics,
}: {
  customers: CustomerListDto[];
  analytics: CustomerAnalytics;
}) {
  const segmentChart = analytics.bySegment.map((s) => ({
    name: CUSTOMER_SEGMENT_LABELS[s.segment],
    count: s.count,
    revenue: s.revenue,
  }));

  return (
    <div className="space-y-6">
      <CustomerKpis analytics={analytics} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="erp-kpi-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold">Sales trend (6 months)</h3>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.salesTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatInr(Number(v))} />
                <Bar dataKey="revenue" fill="#B68D40" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Top customers</h3>
          <ul className="mt-3 space-y-2">
            {analytics.topCustomers.slice(0, 5).map((c, i) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span>
                  <span className="mr-2 text-xs text-muted-foreground">{i + 1}.</span>
                  {c.name}
                </span>
                <span className="font-semibold text-[#B68D40]">{formatInr(c.ltv)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Suspense fallback={null}>
        <CustomerFilters />
      </Suspense>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{customers.length} customer(s)</p>
        <div className="flex gap-2">
          <CustomerExportMenu />
          <AddCustomerDialog />
        </div>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers match your filters"
          description="Adjust filters or add a new customer to get started."
        />
      ) : (
        <CustomerTable customers={customers} />
      )}
    </div>
  );
}
