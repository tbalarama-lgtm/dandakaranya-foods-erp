"use client";

import { FINANCE_BRANCHES } from "@/lib/finance/mock-data";

export function FinanceFiltersBar({
  branch,
  onBranch,
  period,
  onPeriod,
}: {
  branch: string;
  onBranch: (v: string) => void;
  period: string;
  onPeriod: (v: string) => void;
}) {
  const selectClass =
    "flex h-9 rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500";

  return (
    <div className="flex flex-wrap gap-3">
      <select className={selectClass} value={period} onChange={(e) => onPeriod(e.target.value)}>
        <option value="mtd">Month to date</option>
        <option value="qtd">Quarter to date</option>
        <option value="ytd">Year to date</option>
        <option value="fy">Financial year</option>
      </select>
      <select className={selectClass} value={branch} onChange={(e) => onBranch(e.target.value)}>
        {FINANCE_BRANCHES.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
    </div>
  );
}
