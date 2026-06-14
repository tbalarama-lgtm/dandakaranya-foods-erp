"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, MoreHorizontal, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoiceStatusBadge } from "@/components/sales/invoice-status-badge";
import type { InvoiceListDto } from "@/lib/invoice-types";
import { INVOICE_TAX_MODE_LABELS } from "@/lib/invoice-types";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";

type SortKey = "invoiceNumber" | "customerName" | "total" | "invoiceDate" | "status";

export function InvoiceTable({ invoices }: { invoices: InvoiceListDto[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("invoiceDate");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...invoices];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [invoices, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const th = (key: SortKey, label: string) => (
    <th className="cursor-pointer px-4 py-3 hover:text-foreground" onClick={() => toggleSort(key)}>
      {label}
      {sortKey === key && (sortAsc ? " ↑" : " ↓")}
    </th>
  );

  return (
    <div className="erp-kpi-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/80 text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur">
            <tr>
              {th("invoiceNumber", "Invoice")}
              {th("customerName", "Customer")}
              <th className="px-4 py-3">Salesperson</th>
              {th("total", "Amount")}
              <th className="px-4 py-3">Balance</th>
              {th("status", "Status")}
              {th("invoiceDate", "Date")}
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Tax</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {sorted.map((inv) => (
              <tr key={inv.id} className="group transition-colors hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={`/sales/${inv.id}`} className="font-semibold hover:text-[#B68D40]">
                    {inv.invoiceNumber}
                  </Link>
                  {inv.salesOrderNumber && (
                    <p className="text-[10px] text-muted-foreground">SO: {inv.salesOrderNumber}</p>
                  )}
                </td>
                <td className="px-4 py-3">{inv.customerName}</td>
                <td className="px-4 py-3 text-muted-foreground">{inv.salesperson}</td>
                <td className="px-4 py-3 font-semibold">
                  {inv.currency === "INR" ? formatInr(inv.total) : `${inv.currency} ${inv.total.toLocaleString()}`}
                </td>
                <td className={cn("px-4 py-3", inv.balance > 0 && "text-amber-700 font-medium")}>
                  {formatInr(inv.balance)}
                </td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={inv.status} />
                  {inv.isOverdue && (
                    <span className="ml-1 text-[10px] font-semibold text-red-600">OVERDUE</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.invoiceDate)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {INVOICE_TAX_MODE_LABELS[inv.taxMode]}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                    <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" asChild>
                      <Link href={`/sales/${inv.id}`}>
                        <Eye className="h-4 w-4" strokeWidth={ICON_STROKE} />
                      </Link>
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" asChild>
                      <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4" strokeWidth={ICON_STROKE} />
                      </a>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/sales/${inv.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">
                            <Download className="mr-2 h-4 w-4" />
                            PDF export
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/sales/${inv.id}?action=remind`}>
                            <Send className="mr-2 h-4 w-4" />
                            Send reminder
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
    </div>
  );
}
