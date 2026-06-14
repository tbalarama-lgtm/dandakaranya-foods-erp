"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ClipboardCheck, Eye, Search, XCircle } from "lucide-react";
import type { ProcurementApprovalType } from "@prisma/client";
import { approvePoLevel } from "@/actions/po";
import type { ApprovalRow } from "@/lib/procurement-types";
import { APPROVAL_STATE_LABELS, LIFECYCLE_LABELS, LIFECYCLE_STYLES } from "@/lib/procurement-types";
import { Button } from "@/components/ui/button";
import { formatInr, cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { toast } from "sonner";

const LEVELS: { key: ProcurementApprovalType; field: keyof Pick<ApprovalRow, "procurement" | "finance" | "inventory" | "budget"> }[] = [
  { key: "PROCUREMENT", field: "procurement" },
  { key: "FINANCE", field: "finance" },
  { key: "INVENTORY", field: "inventory" },
  { key: "BUDGET", field: "budget" },
];

export function ApprovalsPlatform({ rows, canEdit }: { rows: ApprovalRow[]; canEdit: boolean }) {
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();

  const kpis = useMemo(() => {
    let pendingTotal = 0;
    let fullyApproved = 0;
    let blocked = 0;
    for (const r of rows) {
      const levels = [r.procurement, r.finance, r.inventory, r.budget];
      const pendingLevels = levels.filter((s) => s === "PENDING").length;
      pendingTotal += pendingLevels;
      if (levels.every((s) => s === "APPROVED")) fullyApproved += 1;
      if (levels.some((s) => s === "REJECTED")) blocked += 1;
    }
    return { total: rows.length, pendingTotal, fullyApproved, blocked };
  }, [rows]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter(
      (r) => r.purchaseNumber.toLowerCase().includes(s) || r.vendorName.toLowerCase().includes(s),
    );
  }, [rows, q]);

  function handleApprove(purchaseId: string, type: ProcurementApprovalType, approve: boolean) {
    startTransition(async () => {
      const res = await approvePoLevel(purchaseId, type, approve ? "APPROVED" : "REJECTED");
      if (res.ok) toast.success(approve ? "Approved" : "Rejected");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={ClipboardCheck} label="POs in workflow" value={String(kpis.total)} sub={`${kpis.pendingTotal} pending sign-offs`} />
        <Kpi icon={CheckCircle2} label="Fully approved" value={String(kpis.fullyApproved)} sub="Ready for GRN / execution" />
        <Kpi icon={XCircle} label="Blocked" value={String(kpis.blocked)} sub="Rejected at one or more levels" />
        <Kpi icon={ClipboardCheck} label="Open value" value={formatInr(filtered.reduce((s, r) => s + r.total, 0))} sub="Filtered PO total" />
      </div>

      <p className="text-xs text-muted-foreground">
        4-level workflow: Procurement → Finance → Inventory → Budget. All four must approve before PO execution and GRN intake.
      </p>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search PO # or vendor…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm"
        />
      </div>

      <div className="erp-table-shell overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b bg-muted/80 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">PO #</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Procurement</th>
              <th className="px-4 py-3">Finance</th>
              <th className="px-4 py-3">Inventory</th>
              <th className="px-4 py-3">Budget</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No purchase orders awaiting approval workflow.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.purchaseId} className="erp-table-row">
                  <td className="px-4 py-3.5 font-mono text-xs">
                    <Link
                      href={`/purchases/${r.purchaseId}`}
                      className="text-[#B68D40] hover:underline"
                      spellCheck={false}
                    >
                      {r.purchaseNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 font-medium">{r.vendorName}</td>
                  <td className="px-4 py-3.5 font-semibold">{formatInr(r.total)}</td>
                  <td className="px-4 py-3.5">
                    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", LIFECYCLE_STYLES[r.stage])}>
                      {LIFECYCLE_LABELS[r.stage]}
                    </span>
                  </td>
                  {LEVELS.map(({ key, field }) => (
                    <td key={key} className="px-4 py-3.5">
                      <ApprovalCell
                        status={r[field]}
                        canEdit={canEdit}
                        disabled={pending}
                        onApprove={() => handleApprove(r.purchaseId, key, true)}
                        onReject={() => handleApprove(r.purchaseId, key, false)}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3.5 text-right">
                    <Button type="button" size="sm" variant="ghost" asChild>
                      <Link href={`/purchases/${r.purchaseId}`}>
                        <Eye className="mr-1 h-4 w-4" />
                        PO
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

function ApprovalCell({
  status,
  canEdit,
  disabled,
  onApprove,
  onReject,
}: {
  status: ApprovalRow["procurement"];
  canEdit: boolean;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const style =
    status === "APPROVED"
      ? "bg-emerald-500/12 text-emerald-700"
      : status === "REJECTED"
        ? "bg-red-500/12 text-red-700"
        : "bg-amber-500/12 text-amber-700";

  return (
    <div className="flex flex-col gap-1">
      <span className={cn("inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-semibold", style)}>
        {APPROVAL_STATE_LABELS[status]}
      </span>
      {canEdit && status === "PENDING" && (
        <div className="flex gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={onApprove}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-500/10"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onReject}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-500/10"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof ClipboardCheck;
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
