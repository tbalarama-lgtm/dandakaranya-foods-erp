"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Mail,
  MoreHorizontal,
  Phone,
  Receipt,
  ShoppingCart,
} from "lucide-react";
import type { CustomerListDto } from "@/lib/customer-types";
import {
  CustomerRiskBadge,
  CustomerSegmentBadge,
  CustomerStatusBadge,
  HighValueBadge,
} from "@/components/customers/customer-badges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, formatInr } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { cn } from "@/lib/utils";

type SortKey = "name" | "ltv" | "outstanding" | "segment";

export function CustomerTable({ customers }: { customers: CustomerListDto[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...customers];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "ltv") cmp = a.lifetimeValue - b.lifetimeValue;
      else if (sortKey === "outstanding") cmp = a.outstanding - b.outstanding;
      else if (sortKey === "segment") cmp = a.segment.localeCompare(b.segment);
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [customers, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  return (
    <div className="erp-table-shell overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-border/60 bg-muted/80 backdrop-blur text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          <tr>
            <SortHeader label="Customer" sortKey="name" active={sortKey} asc={sortAsc} onSort={toggleSort} />
            <SortHeader label="Segment" sortKey="segment" active={sortKey} asc={sortAsc} onSort={toggleSort} />
            <th className="px-4 py-3 font-semibold">Status</th>
            <SortHeader label="LTV" sortKey="ltv" active={sortKey} asc={sortAsc} onSort={toggleSort} />
            <SortHeader label="Outstanding" sortKey="outstanding" active={sortKey} asc={sortAsc} onSort={toggleSort} />
            <th className="px-4 py-3 font-semibold">Risk</th>
            <th className="px-4 py-3 font-semibold">Last order</th>
            <th className="px-4 py-3 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {sorted.map((c) => (
            <tr key={c.id} className="erp-table-row group">
              <td className="px-4 py-3.5">
                <Link href={`/customers/${c.id}`} className="font-semibold hover:text-[#B68D40]">
                  {c.name}
                </Link>
                <p className="text-xs text-muted-foreground">{c.company ?? c.phone}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.isHighValue && <HighValueBadge />}
                  {c.overdueCount > 0 && (
                    <span className="rounded-md bg-red-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                      {c.overdueCount} overdue
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3.5">
                <CustomerSegmentBadge segment={c.segment} />
              </td>
              <td className="px-4 py-3.5">
                <CustomerStatusBadge status={c.status} />
              </td>
              <td className="px-4 py-3.5 font-semibold text-[#B68D40]">{formatInr(c.lifetimeValue)}</td>
              <td className={cn("px-4 py-3.5 font-medium", c.outstanding > 0 && "text-amber-700")}>
                {formatInr(c.outstanding)}
                {c.creditLimit != null && (
                  <p className="text-[10px] text-muted-foreground">{c.creditUtilization}% of limit</p>
                )}
              </td>
              <td className="px-4 py-3.5">
                <CustomerRiskBadge risk={c.creditRisk} />
              </td>
              <td className="px-4 py-3.5 text-xs text-muted-foreground">
                {c.lastOrderAt ? formatDate(new Date(c.lastOrderAt)) : "—"}
              </td>
              <td className="px-4 py-3.5">
                <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" asChild>
                    <a href={`tel:${c.phone}`}>
                      <Phone className="h-4 w-4" strokeWidth={ICON_STROKE} />
                    </a>
                  </Button>
                  {c.email && (
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" asChild>
                      <a href={`mailto:${c.email}`}>
                        <Mail className="h-4 w-4" strokeWidth={ICON_STROKE} />
                      </a>
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" strokeWidth={ICON_STROKE} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/customers/${c.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/customers/${c.id}?tab=ledger`}>
                          <FileText className="mr-2 h-4 w-4" />
                          View ledger
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/quotations/new?customerId=${c.id}`}>
                          <FileText className="mr-2 h-4 w-4" />
                          Create quotation
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/sales/new?customerId=${c.id}`}>
                          <Receipt className="mr-2 h-4 w-4" />
                          Create invoice
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/sales/new?customerId=${c.id}`}>
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Create order
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

function SortHeader({
  label,
  sortKey,
  active,
  asc,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  asc: boolean;
  onSort: (k: SortKey) => void;
}) {
  return (
    <th className="px-4 py-3 font-semibold">
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <ArrowUpDown className={cn("h-3.5 w-3.5", active === sortKey && "text-[#B68D40]")} />
        {active === sortKey && <span className="sr-only">{asc ? "ascending" : "descending"}</span>}
      </button>
    </th>
  );
}

export function CustomerExportMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <Download className="h-4 w-4" strokeWidth={ICON_STROKE} />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href="/api/v1/customers/export?format=csv" download>
            <FileText className="mr-2 h-4 w-4" />
            CSV
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/api/v1/customers/export?format=excel" download>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/api/v1/customers/export?format=pdf" target="_blank" rel="noreferrer">
            <FileText className="mr-2 h-4 w-4" />
            PDF (print)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
