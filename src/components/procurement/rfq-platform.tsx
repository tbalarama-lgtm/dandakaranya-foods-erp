"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Eye, Plus } from "lucide-react";
import type { RFQListDto } from "@/lib/vendor-types";
import { RFQ_STATUS_LABELS } from "@/lib/vendor-types";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function RFQPlatform({ rfqs }: { rfqs: RFQListDto[] }) {
  const [sortKey, setSortKey] = useState<"date" | "quotes" | "lowest">("date");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...rfqs];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortKey === "quotes") cmp = a.quoteCount - b.quoteCount;
      else if (sortKey === "lowest") cmp = (a.lowestQuote ?? 0) - (b.lowestQuote ?? 0);
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [rfqs, sortKey, sortAsc]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{rfqs.length} RFQ(s)</p>
        <Button type="button" size="sm" asChild>
          <Link href="/procurement/rfq/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New RFQ
          </Link>
        </Button>
      </div>

      <div className="erp-table-shell overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-border/60 bg-muted/80 backdrop-blur text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">RFQ #</th>
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Product</th>
              <SortHeader label="Quotes" sortKey="quotes" active={sortKey} asc={sortAsc} onSort={setSortKey} />
              <SortHeader label="Lowest quote" sortKey="lowest" active={sortKey} asc={sortAsc} onSort={setSortKey} />
              <th className="px-4 py-3 font-semibold">Due</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {sorted.map((r) => (
              <tr key={r.id} className="erp-table-row group">
                <td className="px-4 py-3.5 font-mono text-xs">{r.rfqNumber}</td>
                <td className="px-4 py-3.5 font-semibold">{r.title}</td>
                <td className="px-4 py-3.5">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold">
                    {RFQ_STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-muted-foreground">
                  {r.productName ?? "—"}
                  {r.quantity != null && ` · ${r.quantity} ${r.unit ?? "kg"}`}
                </td>
                <td className="px-4 py-3.5">{r.quoteCount}</td>
                <td className="px-4 py-3.5 font-semibold text-[#B68D40]">
                  {r.lowestQuote != null ? formatInr(r.lowestQuote) : "—"}
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">
                  {r.dueDate ? formatDate(new Date(r.dueDate)) : "—"}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <Link href={`/procurement/rfq/${r.id}`}>
                      <Eye className="mr-1 h-4 w-4" />
                      Compare
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  active,
  asc,
  onSort,
}: {
  label: string;
  sortKey: "date" | "quotes" | "lowest";
  active: "date" | "quotes" | "lowest";
  asc: boolean;
  onSort: (k: "date" | "quotes" | "lowest") => void;
}) {
  return (
    <th className="px-4 py-3 font-semibold">
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active === sortKey && "text-[#B68D40]")} />
      </button>
    </th>
  );
}
