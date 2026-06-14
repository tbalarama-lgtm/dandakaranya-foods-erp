"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProcurementKpis, WorkflowStep } from "@/lib/vendor-types";
import { PROCUREMENT_STAGE_LABELS } from "@/lib/vendor-types";
import { formatInr } from "@/lib/utils";
import { PackageCheck, ClipboardCheck, FileSpreadsheet, IndianRupee, Truck } from "lucide-react";

export function ProcurementDashboard({
  kpis,
  workflow,
}: {
  kpis: ProcurementKpis;
  workflow: WorkflowStep[];
}) {
  const cards = [
    { label: "Total POs", value: String(kpis.totalPos), icon: Truck, sub: `${kpis.pendingApprovals} pending approval` },
    { label: "Spend this month", value: formatInr(kpis.spendThisMonth), icon: IndianRupee, sub: `${formatInr(kpis.paidThisMonth)} paid` },
    { label: "Outstanding bills", value: formatInr(kpis.outstandingBills), icon: FileSpreadsheet, sub: "Vendor payables" },
    { label: "Pending GRNs", value: String(kpis.pendingGrns), icon: PackageCheck, sub: `${kpis.onTimeDeliveryPct}% on-time delivery` },
    { label: "Avg PO cycle", value: `${kpis.avgPoCycleDays} days`, icon: ClipboardCheck, sub: "PO to payment" },
  ];

  const chartData = workflow.map((w) => ({
    name: PROCUREMENT_STAGE_LABELS[w.stage],
    count: w.count,
    value: w.value,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="erp-kpi-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <p className="mt-1 text-xl font-bold text-[#B68D40]">{c.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
              </div>
              <c.icon className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>

      <div className="erp-kpi-card p-5">
        <h3 className="text-sm font-semibold">Procurement workflow pipeline</h3>
        <p className="mt-1 text-xs text-muted-foreground">Vendor → PO → GRN → Bill → Payment</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {workflow.map((w, i) => (
            <div key={w.stage} className="flex items-center gap-2">
              <div className="rounded-xl border border-border/60 px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {PROCUREMENT_STAGE_LABELS[w.stage]}
                </p>
                <p className="text-lg font-bold">{w.count}</p>
                <p className="text-xs text-[#B68D40]">{formatInr(w.value)}</p>
              </div>
              {i < workflow.length - 1 && <span className="text-xl text-muted-foreground">→</span>}
            </div>
          ))}
        </div>
        <div className="mt-6 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#1E3A5F" radius={[4, 4, 0, 0]} name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink href="/vendors" label="Supplier master" desc="Vendor profiles & analytics" />
        <QuickLink href="/procurement/rfq" label="RFQ & quotes" desc="Compare vendor quotations" />
        <QuickLink href="/purchases/approvals" label="Approvals & GRN" desc="Procurement approval workflow" />
        <QuickLink href="/finance/purchases" label="Bills & payments" desc="Outstanding payables tracking" />
      </div>
    </div>
  );
}

function QuickLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <Link href={href} className="erp-kpi-card block p-4 transition hover:border-[#B68D40]/40 hover:shadow-sm">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </Link>
  );
}
