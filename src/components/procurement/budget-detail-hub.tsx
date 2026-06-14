"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Clock, FileText, Lock, Unlock } from "lucide-react";
import { approveBudgetAction, createBudgetRevision, lockBudget, unlockBudget, runBudgetForecast } from "@/actions/budget-workflow";
import type { BudgetDetail } from "@/lib/budget-types";
import {
  BUDGET_APPROVAL_LABELS,
  BUDGET_AUDIT_LABELS,
  BUDGET_SCENARIO_LABELS,
  BUDGET_STATUS_LABELS,
  BUDGET_TIER_LABELS,
  BUDGET_TIER_STYLES,
} from "@/lib/budget-types";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { toast } from "sonner";

export function BudgetDetailHub({ detail, canEdit }: { detail: BudgetDetail; canEdit: boolean }) {
  const [revisionAmount, setRevisionAmount] = useState(String(detail.row.budgetAmount));
  const [revisionReason, setRevisionReason] = useState("");
  const [pending, startTransition] = useTransition();
  const { row } = detail;

  function submitRevision() {
    startTransition(async () => {
      const res = await createBudgetRevision(row.id, Number(revisionAmount), revisionReason);
      if (res.ok) toast.success("Revision submitted for approval");
      else toast.error(res.error);
    });
  }

  function approve(type: "CREATION" | "REVISION" | "OVERSPEND", approve: boolean) {
    startTransition(async () => {
      const res = await approveBudgetAction(row.id, type, approve);
      if (res.ok) toast.success(approve ? "Approved" : "Rejected");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/procurement/budgets">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Budget control
          </Link>
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{row.label}</h2>
          <p className="text-sm text-muted-foreground">
            {BUDGET_STATUS_LABELS[row.status]} · {BUDGET_SCENARIO_LABELS[row.scenario]} · {BUDGET_TIER_LABELS[row.tier]}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-semibold">{row.utilizationPct}%</p>
          <div className="mt-1 h-2 w-40 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", row.tier === "CRITICAL" || row.tier === "LOCKED" ? "bg-red-500" : row.tier === "WARNING" ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.min(row.utilizationPct, 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Budget" value={formatInr(row.budgetAmount)} />
        <Metric label="Spent" value={formatInr(row.spentAmount)} />
        <Metric label="Committed (POs)" value={formatInr(row.committedAmount)} />
        <Metric label="Remaining" value={formatInr(row.remaining)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="PO budget mapping" icon={FileText}>
          {detail.poLinks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No purchase orders linked yet.</p>
          ) : (
            <div className="space-y-2">
              {detail.poLinks.map((p) => (
                <div key={p.purchaseId} className="flex justify-between text-xs">
                  <Link href={`/purchases/${p.purchaseId}`} className="font-mono text-[#B68D40] hover:underline" spellCheck={false}>
                    {p.purchaseNumber}
                  </Link>
                  <span>{formatInr(p.amount)} · {p.status}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Revision history" icon={Clock}>
          {detail.revisions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No revisions yet.</p>
          ) : (
            detail.revisions.map((r) => (
              <div key={r.revisionNumber} className="mb-2 text-xs">
                <p className="font-medium">Rev #{r.revisionNumber}: {formatInr(r.previousAmount)} → {formatInr(r.newAmount)}</p>
                {r.reason && <p className="text-muted-foreground">{r.reason}</p>}
              </div>
            ))
          )}
          {canEdit && (
            <div className="mt-3 space-y-2 border-t pt-3">
              <input type="number" value={revisionAmount} onChange={(e) => setRevisionAmount(e.target.value)} className="h-8 w-full rounded border px-2 text-sm" placeholder="New amount" />
              <input type="text" value={revisionReason} onChange={(e) => setRevisionReason(e.target.value)} className="h-8 w-full rounded border px-2 text-sm" placeholder="Reason" />
              <Button type="button" size="sm" disabled={pending} onClick={submitRevision}>Submit revision</Button>
            </div>
          )}
        </Section>
      </div>

      {detail.approvals.filter((a) => a.status === "PENDING").length > 0 && canEdit && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="mb-2 text-sm font-medium">Pending approvals</p>
          {detail.approvals.filter((a) => a.status === "PENDING").map((a) => (
            <div key={a.id} className="flex gap-2 text-xs">
              <span>{BUDGET_APPROVAL_LABELS[a.approvalType]}</span>
              <button type="button" disabled={pending} onClick={() => approve(a.approvalType, true)} className="text-emerald-700 underline">Approve</button>
              <button type="button" disabled={pending} onClick={() => approve(a.approvalType, false)} className="text-red-700 underline">Reject</button>
            </div>
          ))}
        </div>
      )}

      <Section title="Audit & compliance log" icon={FileText}>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {detail.auditLog.map((e) => (
            <div key={e.id} className="border-l-2 border-[#B68D40]/40 pl-3 text-xs">
              <p className="font-medium">{e.title}</p>
              <p className="text-muted-foreground">{BUDGET_AUDIT_LABELS[e.action]} · {e.actorName ?? "System"} · {formatDate(e.createdAt)}</p>
              {e.detail && <p className="text-muted-foreground">{e.detail}</p>}
            </div>
          ))}
        </div>
      </Section>

      {canEdit && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const r = await runBudgetForecast(row.id); if (r.ok) toast.success("Forecast updated"); })}>
            Run AI forecast
          </Button>
          {row.isLocked ? (
            <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const r = await unlockBudget(row.id); if (r.ok) toast.success("Unlocked"); })}>
              <Unlock className="mr-1 h-4 w-4" /> Unlock budget
            </Button>
          ) : (
            <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const r = await lockBudget(row.id, "Manual control"); if (r.ok) toast.success("Locked"); })}>
              <Lock className="mr-1 h-4 w-4" /> Lock budget
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4" />{title}</p>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
