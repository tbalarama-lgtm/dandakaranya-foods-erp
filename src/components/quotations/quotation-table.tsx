"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  Send,
} from "lucide-react";
import type { QuotationListDto } from "@/lib/quotation-types";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_STYLES } from "@/lib/quotation-types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";

export function QuotationTable({ quotations }: { quotations: QuotationListDto[] }) {
  const [sortKey, setSortKey] = useState<"quote" | "customer" | "value" | "valid">("quote");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...quotations];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "quote") cmp = a.quoteNumber.localeCompare(b.quoteNumber);
      else if (sortKey === "customer") cmp = a.customerName.localeCompare(b.customerName);
      else if (sortKey === "value") cmp = a.total - b.total;
      else if (sortKey === "valid") cmp = (a.validUntil ?? "").localeCompare(b.validUntil ?? "");
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [quotations, sortKey, sortAsc]);

  const toggle = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div className="erp-table-shell overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full min-w-[1000px] text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-border/60 bg-muted/80 backdrop-blur text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">
              <SortBtn label="Quote #" active={sortKey === "quote"} onClick={() => toggle("quote")} />
            </th>
            <th className="px-4 py-3 font-semibold">
              <SortBtn label="Customer" active={sortKey === "customer"} onClick={() => toggle("customer")} />
            </th>
            <th className="px-4 py-3 font-semibold">Salesperson</th>
            <th className="px-4 py-3 font-semibold">
              <SortBtn label="Value" active={sortKey === "value"} onClick={() => toggle("value")} />
            </th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">
              <SortBtn label="Valid until" active={sortKey === "valid"} onClick={() => toggle("valid")} />
            </th>
            <th className="px-4 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {sorted.map((q) => (
            <tr key={q.id} className="erp-table-row group">
              <td className="px-4 py-3.5">
                <Link href={`/quotations/${q.id}`} className="font-semibold hover:text-[#B68D40]">
                  {q.quoteNumber}
                </Link>
                {q.revisionNumber > 1 && (
                  <span className="ml-1 text-[10px] text-muted-foreground">R{q.revisionNumber}</span>
                )}
                {q.requiresApproval && (
                  <span className="ml-2 rounded bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                    Approval
                  </span>
                )}
              </td>
              <td className="px-4 py-3.5">{q.customerName}</td>
              <td className="px-4 py-3.5 text-muted-foreground">{q.salesperson}</td>
              <td className="px-4 py-3.5 font-semibold text-[#B68D40]">
                {q.currency === "INR" ? formatInr(q.total) : `${q.currency} ${q.total.toLocaleString()}`}
              </td>
              <td className="px-4 py-3.5">
                <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase", QUOTE_STATUS_STYLES[q.status])}>
                  {QUOTE_STATUS_LABELS[q.status]}
                </span>
                {q.isExpired && <span className="ml-1 text-[10px] text-red-600">Expired</span>}
              </td>
              <td className="px-4 py-3.5 text-xs text-muted-foreground">
                {q.validUntil ? formatDate(new Date(q.validUntil)) : "—"}
              </td>
              <td className="px-4 py-3.5">
                <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" asChild>
                    <Link href={`/quotations/${q.id}`}>
                      <Eye className="h-4 w-4" strokeWidth={ICON_STROKE} />
                    </Link>
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" asChild>
                    <a href={`/api/quotations/${q.id}/pdf`} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" strokeWidth={ICON_STROKE} />
                    </a>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" strokeWidth={ICON_STROKE} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/quotations/${q.id}`}>
                          <FileText className="mr-2 h-4 w-4" />
                          View details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href={`/api/quotations/${q.id}/pdf`} target="_blank" rel="noreferrer">
                          <Download className="mr-2 h-4 w-4" />
                          Download PDF
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/quotations/${q.id}?action=send`}>
                          <Send className="mr-2 h-4 w-4" />
                          Send quote
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={onClick}>
      {label}
      <ArrowUpDown className={cn("h-3.5 w-3.5", active && "text-[#B68D40]")} />
    </button>
  );
}
