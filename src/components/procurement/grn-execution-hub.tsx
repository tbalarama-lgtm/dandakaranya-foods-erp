"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpDown,
  ClipboardCheck,
  Eye,
  Package,
  Search,
  ShieldAlert,
  Truck,
  Warehouse,
} from "lucide-react";
import type { GrnLifecycleStatus } from "@prisma/client";
import { autoCreateGrnsFromDeliveredPos } from "@/actions/grn";
import type { GrnExecutionKpis, GrnListRow, SupplierQcTrendPoint } from "@/lib/grn-types";
import { GRN_LIFECYCLE_LABELS, GRN_LIFECYCLE_STYLES } from "@/lib/grn-types";
import { TAMARIND_GRADE_LABELS } from "@/lib/vendor-types";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function GrnExecutionHub({
  grns,
  kpis,
  qcTrends,
  awaitingAuto,
}: {
  grns: GrnListRow[];
  kpis: GrnExecutionKpis;
  qcTrends: SupplierQcTrendPoint[];
  awaitingAuto: { id: string; purchaseNumber: string; vendorName: string }[];
}) {
  const [q, setQ] = useState("");
  const [lifecycle, setLifecycle] = useState<GrnLifecycleStatus | "">("");
  const [sortKey, setSortKey] = useState<"date" | "value" | "vendor">("date");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    let rows = [...grns];
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.grnNumber.toLowerCase().includes(s) ||
          r.purchaseNumber.toLowerCase().includes(s) ||
          r.vendorName.toLowerCase().includes(s),
      );
    }
    if (lifecycle) rows = rows.filter((r) => r.lifecycle === lifecycle);
    rows.sort((a, b) => {
      if (sortKey === "value") return b.intakeValue - a.intakeValue;
      if (sortKey === "vendor") return a.vendorName.localeCompare(b.vendorName);
      return new Date(b.receivedAt ?? 0).getTime() - new Date(a.receivedAt ?? 0).getTime();
    });
    return rows;
  }, [grns, q, lifecycle, sortKey]);

  function handleAutoGrn() {
    startTransition(async () => {
      const res = await autoCreateGrnsFromDeliveredPos();
      if (res.ok) toast.success(`Created ${res.data.created} GRN(s) from delivered POs`);
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={ClipboardCheck} label="Pending QC" value={String(kpis.pendingInspections)} sub={`${kpis.totalGrns} GRNs`} />
        <Kpi icon={ShieldAlert} label="Rejected / quarantine" value={String(kpis.rejectedBatches + kpis.quarantineCount)} sub={`${kpis.returnsOpen} RTV open`} />
        <Kpi icon={Warehouse} label="Intake value" value={formatInr(kpis.intakeValue)} sub={`${kpis.pendingStockPost} await stock post`} />
        <Kpi icon={Truck} label="Supplier quality" value={`${kpis.avgVendorQuality}%`} sub="Rolling avg score" />
      </div>

      {awaitingAuto.length > 0 && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/8 px-4 py-3 text-sm">
          <p className="font-medium text-sky-900 dark:text-sky-200">
            {awaitingAuto.length} delivered PO(s) without GRN —{" "}
            <button type="button" onClick={handleAutoGrn} disabled={pending} className="underline">
              auto-create GRNs
            </button>
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 p-4">
          <p className="mb-3 text-sm font-semibold">Supplier QC pass rate</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={qcTrends}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="passRate" name="Pass %" stroke="#059669" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <p className="mb-3 text-sm font-semibold">Moisture & rejection trends</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={qcTrends}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgMoisture" name="Moisture %" fill="#B68D40" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rejectionRate" name="Reject %" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search GRN #, PO, vendor…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={lifecycle}
            onChange={(e) => setLifecycle(e.target.value as GrnLifecycleStatus | "")}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="">All lifecycle</option>
            {Object.entries(GRN_LIFECYCLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href="/procurement/grn/receive">Mobile receive</Link>
        </Button>
      </div>

      <div className="erp-table-shell overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b bg-muted/80 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">GRN #</th>
              <SortTh label="Vendor" k="vendor" active={sortKey} onSort={setSortKey} />
              <th className="px-4 py-3">Lifecycle</th>
              <th className="px-4 py-3">Qty (ord/rec/rej)</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3">QC</th>
              <SortTh label="Value" k="value" active={sortKey} onSort={setSortKey} />
              <SortTh label="Received" k="date" active={sortKey} onSort={setSortKey} />
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No GRN records. Receive goods against a PO or auto-create from delivered orders.
                </td>
              </tr>
            ) : (
              filtered.map((g) => (
                <tr key={g.id} className={cn("erp-table-row", g.isQuarantine && "bg-orange-500/5")}>
                  <td className="px-4 py-3.5 font-mono text-xs">
                    {g.grnNumber}
                    <p className="text-[10px] text-muted-foreground">{g.purchaseNumber}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/vendors/${g.vendorId}`} className="font-medium hover:text-[#B68D40]">
                      {g.vendorName}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", GRN_LIFECYCLE_STYLES[g.lifecycle])}>
                      {GRN_LIFECYCLE_LABELS[g.lifecycle]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs">
                    {g.orderedQty} / {g.receivedQty} / <span className="text-red-600">{g.rejectedQty}</span>
                  </td>
                  <td className="px-4 py-3.5 text-xs">
                    {g.tamarindGrade ? TAMARIND_GRADE_LABELS[g.tamarindGrade] : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    {g.qcPassed ? (
                      <span className="rounded-md bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Passed</span>
                    ) : g.pendingQcItems > 0 ? (
                      <span className="rounded-md bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Pending</span>
                    ) : (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">{formatInr(g.intakeValue)}</td>
                  <td className="px-4 py-3.5 text-xs">{g.receivedAt ? formatDate(new Date(g.receivedAt)) : "—"}</td>
                  <td className="px-4 py-3.5 text-right">
                    <Button type="button" size="sm" variant="ghost" asChild>
                      <Link href={`/procurement/grn/${g.id}`}>
                        <Eye className="mr-1 h-4 w-4" />
                        Open
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="erp-kpi-card rounded-xl border border-border/60 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold">{value}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
        </div>
        <Icon className="h-5 w-5 text-[#B68D40]" strokeWidth={ICON_STROKE} />
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
  k: "date" | "value" | "vendor";
  active: string;
  onSort: (k: "date" | "value" | "vendor") => void;
}) {
  return (
    <th className="px-4 py-3">
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active === k && "text-[#B68D40]")} />
      </button>
    </th>
  );
}
