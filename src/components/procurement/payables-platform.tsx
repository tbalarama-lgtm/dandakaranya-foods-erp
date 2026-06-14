"use client";

import Link from "next/link";
import type { PayableAgingBucket, PayableRow } from "@/lib/procurement-types";
import { LIFECYCLE_LABELS, LIFECYCLE_STYLES } from "@/lib/procurement-types";
import { formatDate, formatInr } from "@/lib/utils";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

export function PayablesPlatform({
  payables,
  aging,
}: {
  payables: PayableRow[];
  aging: PayableAgingBucket[];
}) {
  const totalOutstanding = payables.reduce((s, p) => s + p.balance, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="erp-kpi-card p-4">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Total outstanding</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{formatInr(totalOutstanding)}</p>
        </div>
        <div className="erp-kpi-card p-4">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Open invoices</p>
          <p className="mt-1 text-2xl font-bold">{payables.length}</p>
        </div>
        <div className="erp-kpi-card p-4">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Overdue</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {payables.filter((p) => p.daysOverdue > 0).length}
          </p>
        </div>
      </div>

      <div className="erp-kpi-card p-5">
        <h3 className="text-sm font-semibold">Aging analysis</h3>
        <div className="mt-4 min-h-[200px] w-full">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={aging}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatInr(Number(v))} />
              <Bar dataKey="amount" fill="#B68D40" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="erp-table-shell overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b bg-muted/80 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">PO #</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Balance</th>
              <th className="px-4 py-3">Due date</th>
              <th className="px-4 py-3">Stage</th>
            </tr>
          </thead>
          <tbody>
            {payables.map((p) => (
              <tr key={p.id} className="border-b border-border/40">
                <td className="px-4 py-3 font-mono text-xs">{p.purchaseNumber}</td>
                <td className="px-4 py-3">
                  <Link href={`/vendors/${p.vendorId}`} className="font-medium hover:text-[#B68D40]">
                    {p.vendorName}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatInr(p.total)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatInr(p.paid)}</td>
                <td className={cn("px-4 py-3 font-semibold", p.daysOverdue > 0 && "text-red-600")}>
                  {formatInr(p.balance)}
                </td>
                <td className="px-4 py-3 text-xs">
                  {p.dueDate ? formatDate(new Date(p.dueDate)) : "—"}
                  {p.daysOverdue > 0 && <span className="ml-1 text-red-600">+{p.daysOverdue}d</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", LIFECYCLE_STYLES[p.stage])}>
                    {LIFECYCLE_LABELS[p.stage]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
