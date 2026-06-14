"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Eye,
  FileText,
  Mail,
  MoreHorizontal,
  Phone,
  ShoppingCart,
  Star,
} from "lucide-react";
import type { VendorListDto } from "@/lib/vendor-types";
import {
  ComplianceBadge,
  FpoPartnerBadge,
  PreferredVendorBadge,
  VendorClassificationBadge,
  VendorStatusBadge,
} from "@/components/vendors/vendor-badges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VENDOR_PAYMENT_TERMS_LABELS } from "@/lib/vendor-types";
import { formatDate, formatInr } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SortKey = "name" | "spend" | "outstanding" | "quality" | "classification";

export function VendorTable({ vendors }: { vendors: VendorListDto[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    const copy = [...vendors];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "spend") cmp = a.totalSpend - b.totalSpend;
      else if (sortKey === "outstanding") cmp = a.outstandingPayable - b.outstandingPayable;
      else if (sortKey === "quality") cmp = (a.qualityScore ?? 0) - (b.qualityScore ?? 0);
      else if (sortKey === "classification") cmp = a.classification.localeCompare(b.classification);
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [vendors, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  const allSelected = sorted.length > 0 && selected.size === sorted.length;

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="erp-kpi-card flex flex-wrap items-center gap-3 p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => toast.success(`Export queued for ${selected.size} vendor(s)`)}
          >
            Export selected
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => toast.success("Bulk status update — select preferred workflow")}
          >
            Bulk status update
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

      <div className="erp-table-shell overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-border/60 bg-muted/80 backdrop-blur text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => {
                    if (e.target.checked) setSelected(new Set(sorted.map((v) => v.id)));
                    else setSelected(new Set());
                  }}
                  className="h-4 w-4 rounded border-border"
                />
              </th>
              <SortHeader label="Vendor" sortKey="name" active={sortKey} asc={sortAsc} onSort={toggleSort} />
              <SortHeader label="Classification" sortKey="classification" active={sortKey} asc={sortAsc} onSort={toggleSort} />
              <th className="px-4 py-3 font-semibold">Status</th>
              <SortHeader label="Spend" sortKey="spend" active={sortKey} asc={sortAsc} onSort={toggleSort} />
              <SortHeader label="Payables" sortKey="outstanding" active={sortKey} asc={sortAsc} onSort={toggleSort} />
              <SortHeader label="Quality" sortKey="quality" active={sortKey} asc={sortAsc} onSort={toggleSort} />
              <th className="px-4 py-3 font-semibold">Terms</th>
              <th className="px-4 py-3 font-semibold">Last PO</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {sorted.map((v) => (
              <tr key={v.id} className="erp-table-row group">
                <td className="px-3 py-3.5">
                  <input
                    type="checkbox"
                    checked={selected.has(v.id)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(v.id);
                      else next.delete(v.id);
                      setSelected(next);
                    }}
                    className="h-4 w-4 rounded border-border"
                  />
                </td>
                <td className="px-4 py-3.5">
                  <Link href={`/vendors/${v.id}`} className="font-semibold hover:text-[#B68D40]">
                    {v.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{v.code ?? v.gstin ?? v.contact ?? "—"}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {v.isFpoPartner && <FpoPartnerBadge />}
                    {v.status === "PREFERRED" && <PreferredVendorBadge />}
                    {v.overdueCount > 0 && (
                      <span className="rounded-md bg-red-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                        {v.overdueCount} overdue
                      </span>
                    )}
                    {v.expiringDocs > 0 && (
                      <span className="rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        {v.expiringDocs} doc expiring
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <VendorClassificationBadge classification={v.classification} />
                </td>
                <td className="px-4 py-3.5">
                  <VendorStatusBadge status={v.status} />
                </td>
                <td className="px-4 py-3.5 font-semibold text-[#B68D40]">{formatInr(v.totalSpend)}</td>
                <td className={cn("px-4 py-3.5 font-medium", v.outstandingPayable > 0 && "text-amber-700")}>
                  {formatInr(v.outstandingPayable)}
                  {v.advancePaid > 0 && (
                    <p className="text-[10px] text-muted-foreground">{formatInr(v.advancePaid)} advance</p>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-[#B68D40]" />
                    <span className="font-semibold">{v.qualityScore?.toFixed(1) ?? "—"}</span>
                  </div>
                  <ComplianceBadge score={v.complianceScore} />
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">
                  {VENDOR_PAYMENT_TERMS_LABELS[v.paymentTerms]}
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">
                  {v.lastPurchaseAt ? formatDate(new Date(v.lastPurchaseAt)) : "—"}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                    {v.phone && (
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" asChild>
                        <a href={`tel:${v.phone}`}>
                          <Phone className="h-4 w-4" strokeWidth={ICON_STROKE} />
                        </a>
                      </Button>
                    )}
                    {v.email && (
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" asChild>
                        <a href={`mailto:${v.email}`}>
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
                          <Link href={`/vendors/${v.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/purchases/new?vendorId=${v.id}`}>
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Create PO
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/procurement/rfq?vendorId=${v.id}`}>
                            <FileText className="mr-2 h-4 w-4" />
                            Send RFQ
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
  onSort: (key: SortKey) => void;
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
        {active === sortKey && <span className="sr-only">{asc ? "ascending" : "descending"}</span>}
      </button>
    </th>
  );
}
