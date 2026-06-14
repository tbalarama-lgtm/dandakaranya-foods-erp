"use client";

import Link from "next/link";
import type { GrnListRow } from "@/lib/procurement-types";
import { GRN_STATUS_LABELS } from "@/lib/procurement-types";
import { TAMARIND_GRADE_LABELS } from "@/lib/vendor-types";
import { formatDate } from "@/lib/utils";
export function GrnPlatform({ grns }: { grns: GrnListRow[] }) {
  return (
    <div className="erp-table-shell overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="sticky top-0 z-10 border-b bg-muted/80 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">GRN #</th>
            <th className="px-4 py-3">PO / Vendor</th>
            <th className="px-4 py-3">Warehouse</th>
            <th className="px-4 py-3">Received</th>
            <th className="px-4 py-3">Qty (ord/rec/dmg)</th>
            <th className="px-4 py-3">Moisture</th>
            <th className="px-4 py-3">Grade</th>
            <th className="px-4 py-3">QC</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {grns.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                No GRN records. GRNs are created when goods are received against a purchase order.
              </td>
            </tr>
          ) : (
            grns.map((g) => (
              <tr key={g.id} className="erp-table-row hover:bg-muted/30">
                <td className="px-4 py-3.5 font-mono text-xs">{g.grnNumber}</td>
                <td className="px-4 py-3.5">
                  <p className="font-medium">{g.purchaseNumber}</p>
                  <Link href={`/vendors/${g.vendorId}`} className="text-xs text-muted-foreground hover:text-[#B68D40]">
                    {g.vendorName}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-muted-foreground">{g.warehouseName ?? "Default"}</td>
                <td className="px-4 py-3.5 text-xs">{g.receivedAt ? formatDate(new Date(g.receivedAt)) : "—"}</td>
                <td className="px-4 py-3.5 font-mono text-xs">
                  {g.orderedQty} / {g.receivedQty} / <span className="text-red-600">{g.damagedQty}</span>
                </td>
                <td className="px-4 py-3.5">{g.moisturePct != null ? `${g.moisturePct}%` : "—"}</td>
                <td className="px-4 py-3.5 text-xs">
                  {g.tamarindGrade ? TAMARIND_GRADE_LABELS[g.tamarindGrade] : "—"}
                </td>
                <td className="px-4 py-3.5">
                  {g.qcPassed ? (
                    <span className="rounded-md bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Passed
                    </span>
                  ) : (
                    <span className="rounded-md bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold">
                    {GRN_STATUS_LABELS[g.status]}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
