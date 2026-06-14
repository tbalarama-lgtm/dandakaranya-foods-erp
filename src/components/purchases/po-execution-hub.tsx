"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpDown,
  Clock,
  Eye,
  Package,
  Plus,
  Search,
  Truck,
} from "lucide-react";
import type { PoLifecycleStatus } from "@prisma/client";
import type { PoExecutionKpis, PoListRow } from "@/lib/po-types";
import { PO_STATUS_LABELS, PO_STATUS_STYLES, SHIPMENT_STATUS_LABELS } from "@/lib/po-types";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";

export function PoExecutionHub({
  orders,
  kpis,
  canCreate,
}: {
  orders: PoListRow[];
  kpis: PoExecutionKpis;
  canCreate: boolean;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<PoLifecycleStatus | "">("");
  const [sortKey, setSortKey] = useState<"date" | "total" | "vendor">("date");

  const filtered = useMemo(() => {
    let rows = [...orders];
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.purchaseNumber.toLowerCase().includes(s) ||
          r.vendorName.toLowerCase().includes(s) ||
          (r.rfqNumber?.toLowerCase().includes(s) ?? false),
      );
    }
    if (status) rows = rows.filter((r) => r.poStatus === status);
    rows.sort((a, b) => {
      if (sortKey === "total") return b.total - a.total;
      if (sortKey === "vendor") return a.vendorName.localeCompare(b.vendorName);
      return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
    });
    return rows;
  }, [orders, q, status, sortKey]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Package} label="Open POs" value={String(kpis.openPos)} sub={`${kpis.totalPos} total`} />
        <Kpi icon={AlertTriangle} label="Delayed" value={String(kpis.delayedPos)} sub={`${kpis.budgetAlerts} budget alerts`} />
        <Kpi icon={Clock} label="Pending approval" value={String(kpis.pendingApproval)} sub={`${kpis.awaitingGrn} awaiting GRN`} />
        <Kpi icon={Truck} label="Outstanding" value={formatInr(kpis.outstandingValue)} sub={`Lead ${kpis.avgLeadTimeDays}d avg`} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search PO #, vendor, RFQ…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PoLifecycleStatus | "")}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            {Object.entries(PO_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {canCreate && (
          <Button type="button" size="sm" asChild>
            <Link href="/purchases/new">
              <Plus className="mr-1.5 h-4 w-4" />
              New PO
            </Link>
          </Button>
        )}
      </div>

      <div className="erp-table-shell overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b bg-muted/80 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">PO #</th>
              <SortTh label="Vendor" k="vendor" active={sortKey} onSort={setSortKey} />
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Shipment</th>
              <th className="px-4 py-3">Received</th>
              <SortTh label="Total" k="total" active={sortKey} onSort={setSortKey} />
              <th className="px-4 py-3">Delivery</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.map((r) => (
              <tr key={r.id} className={cn("erp-table-row", r.isDelayed && "bg-red-500/5")}>
                <td className="px-4 py-3.5 font-mono text-xs">
                  {r.purchaseNumber}
                  {r.rfqNumber && <span className="ml-1 text-[10px] text-muted-foreground">← {r.rfqNumber}</span>}
                </td>
                <td className="px-4 py-3.5 font-semibold">{r.vendorName}</td>
                <td className="px-4 py-3.5">
                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", PO_STATUS_STYLES[r.poStatus])}>
                    {PO_STATUS_LABELS[r.poStatus]}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-xs">{SHIPMENT_STATUS_LABELS[r.shipmentStatus]}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-[#B68D40]" style={{ width: `${r.receivedPct}%` }} />
                    </div>
                    <span className="text-xs">{r.receivedPct}%</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 font-semibold text-[#B68D40]">
                  {formatInr(r.total)}
                  {r.budgetOverPct != null && <span className="ml-1 text-[10px] text-red-600">+{r.budgetOverPct}%</span>}
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">
                  {r.expectedDelivery ? formatDate(new Date(r.expectedDelivery)) : "—"}
                  {r.isDelayed && <AlertTriangle className="ml-1 inline h-3 w-3 text-red-500" />}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <Link href={`/purchases/${r.id}`}>
                      <Eye className="mr-1 h-4 w-4" />
                      Open
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

function Kpi({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="erp-kpi-card p-4">
      <div className="flex gap-3">
        <div className="rounded-lg bg-[#1E3A5F]/10 p-2">
          <Icon className="h-4 w-4 text-[#1E3A5F]" strokeWidth={ICON_STROKE} />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
    </motion.div>
  );
}

function SortTh({
  label,
  k,
  active,
  onSort,
}: {
  label: string;
  k: "date" | "total" | "vendor";
  active: string;
  onSort: (k: "date" | "total" | "vendor") => void;
}) {
  return (
    <th className="px-4 py-3">
      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort(k)}>
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active === k && "text-[#B68D40]")} />
      </button>
    </th>
  );
}
