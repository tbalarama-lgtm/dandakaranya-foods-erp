"use client";

import type { BudgetRow } from "@/lib/procurement-types";
import { VENDOR_CLASSIFICATION_LABELS } from "@/lib/vendor-types";
import { formatInr } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

export function BudgetPlatform({ budgets }: { budgets: BudgetRow[] }) {
  return (
    <div className="space-y-4">
      {budgets.some((b) => b.isAlert) && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4" />
          One or more budget lines exceeded the alert threshold. Review procurement spend before issuing new POs.
        </div>
      )}
      <div className="erp-table-shell overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/80 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Budget line</th>
              <th className="px-4 py-3 text-left">Period</th>
              <th className="px-4 py-3 text-right">Budget</th>
              <th className="px-4 py-3 text-right">Spent</th>
              <th className="px-4 py-3 text-right">Utilization</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {budgets.map((b) => (
              <tr key={b.id} className="border-b border-border/40">
                <td className="px-4 py-3 font-medium">
                  {b.label}
                  {b.classification && (
                    <p className="text-xs text-muted-foreground">
                      {VENDOR_CLASSIFICATION_LABELS[b.classification]}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  FY {b.fiscalYear}
                  {b.month != null ? ` · ${b.month}` : ""}
                </td>
                <td className="px-4 py-3 text-right">{formatInr(b.budgetAmount)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatInr(b.spentAmount)}</td>
                <td className={cn("px-4 py-3 text-right font-semibold", b.isOverBudget && "text-red-600")}>
                  {b.utilizationPct}%
                </td>
                <td className="px-4 py-3">
                  {b.isOverBudget ? (
                    <span className="rounded-md bg-red-500/12 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                      Over budget
                    </span>
                  ) : b.isAlert ? (
                    <span className="rounded-md bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Alert
                    </span>
                  ) : (
                    <span className="rounded-md bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      On track
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
