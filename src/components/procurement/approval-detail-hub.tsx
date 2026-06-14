"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MessageSquare,
  Shield,
  ShieldAlert,
} from "lucide-react";
import type { ProcurementApprovalType } from "@prisma/client";
import {
  addApprovalComment,
  executeApprovalAction,
  runBudgetValidation,
  runComplianceGate,
  runQcGate,
} from "@/actions/approval-workflow";
import type { ApprovalDetail } from "@/lib/approval-types";
import {
  APPROVAL_ACTION_LABELS,
  APPROVAL_STATE_LABELS,
  APPROVAL_STATE_STYLES,
  APPROVAL_TYPE_LABELS,
} from "@/lib/approval-types";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { toast } from "sonner";

export function ApprovalDetailHub({
  detail,
  canEdit,
}: {
  detail: ApprovalDetail;
  canEdit: boolean;
}) {
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const { row } = detail;

  function submitComment() {
    startTransition(async () => {
      const res = await addApprovalComment(row.purchaseId, comment);
      if (res.ok) {
        toast.success("Comment added");
        setComment("");
      } else toast.error(res.error);
    });
  }

  function runGate(fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success("Gate executed");
      else toast.error(res.error);
    });
  }

  function runAction(type: ProcurementApprovalType, action: "APPROVE" | "REJECT" | "SEND_BACK" | "ESCALATE") {
    startTransition(async () => {
      const res = await executeApprovalAction({ purchaseId: row.purchaseId, approvalType: type, action, comment });
      if (res.ok) toast.success("Action recorded");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/procurement/approvals">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to queue
          </Link>
        </Button>
        <div>
          <h2 className="font-mono text-lg font-semibold" spellCheck={false}>
            {row.purchaseNumber}
          </h2>
          <p className="text-sm text-muted-foreground">
            {row.vendorName} · {formatInr(row.total)} · Matrix: {detail.matrixRuleName ?? "Standard"}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-semibold">{row.progressPct}%</p>
          <div className="mt-1 h-2 w-40 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-[#B68D40]" style={{ width: `${row.progressPct}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border/60 p-4 lg:col-span-2">
          <p className="mb-3 text-sm font-medium">Approval levels</p>
          <div className="space-y-2">
            {row.levels.map((level, i) => (
              <div key={level.type} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold", APPROVAL_STATE_STYLES[level.status])}>
                    {i + 1}
                  </div>
                  {i < row.levels.length - 1 && <div className="my-1 w-px flex-1 bg-border" />}
                </div>
                <div className="flex-1 rounded-lg border border-border/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{APPROVAL_TYPE_LABELS[level.type]}</p>
                    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", APPROVAL_STATE_STYLES[level.status])}>
                      {APPROVAL_STATE_LABELS[level.status]}
                    </span>
                  </div>
                  {level.approverName && (
                    <p className="mt-1 text-xs text-muted-foreground">By {level.approverName}</p>
                  )}
                  {level.approvedAt && (
                    <p className="text-xs text-muted-foreground">{formatDate(level.approvedAt)}</p>
                  )}
                  {level.isOverdue && (
                    <p className="mt-1 text-xs font-medium text-red-600">Overdue — SLA breached</p>
                  )}
                  {canEdit && (level.status === "PENDING" || level.status === "ESCALATED" || level.status === "SENT_BACK") && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(["APPROVE", "REJECT", "SEND_BACK", "ESCALATE"] as const).map((a) => (
                        <button
                          key={a}
                          type="button"
                          disabled={pending}
                          onClick={() => runAction(level.type, a)}
                          className="rounded px-2 py-1 text-[10px] font-medium text-[#B68D40] hover:bg-[#B68D40]/10"
                        >
                          {a.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 p-4">
            <p className="mb-2 text-sm font-medium">Budget validation</p>
            <p className={cn("text-xs font-semibold", detail.budgetAnalysis.status === "OK" ? "text-emerald-700" : detail.budgetAnalysis.status === "ALERT" ? "text-amber-700" : "text-red-700")}>
              {detail.budgetAnalysis.status}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{detail.budgetAnalysis.message}</p>
            {detail.budgetAnalysis.departmentBudget != null && (
              <p className="mt-2 text-xs">
                Dept budget: {formatInr(detail.budgetAnalysis.departmentBudget)} · Spent:{" "}
                {formatInr(detail.budgetAnalysis.departmentSpent ?? 0)}
              </p>
            )}
            {canEdit && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                disabled={pending}
                onClick={() => runGate(() => runBudgetValidation(row.purchaseId))}
              >
                Re-run budget check
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-border/60 p-4">
            <p className="mb-2 text-sm font-medium">Food manufacturing gates</p>
            <div className="space-y-2 text-xs">
              <GateRow icon={ShieldAlert} label="QC approval" active={row.requiresQc} />
              <GateRow icon={Shield} label="Compliance" active={row.requiresCompliance} />
              <GateRow icon={Clock} label="Seasonal review" active={row.isSeasonal} />
              <GateRow icon={CheckCircle2} label="Supplier cert" active={!row.supplierCertOk} warn={!row.supplierCertOk} />
            </div>
            {canEdit && (
              <div className="mt-3 flex flex-col gap-2">
                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => runGate(() => runQcGate(row.purchaseId))}>
                  Run QC gate
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => runGate(() => runComplianceGate(row.purchaseId))}>
                  Run compliance check
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4" />
            Action history & escalation log
          </p>
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {detail.timeline.length === 0 ? (
              <p className="text-xs text-muted-foreground">No workflow events yet.</p>
            ) : (
              detail.timeline.map((e) => (
                <div key={e.id} className="border-l-2 border-[#B68D40]/40 pl-3">
                  <p className="text-xs font-medium">{e.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {APPROVAL_ACTION_LABELS[e.action]} · {e.actorName ?? "System"} · {formatDate(e.createdAt)}
                  </p>
                  {e.detail && <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="h-4 w-4" />
            Discussion thread
          </p>
          <div className="mb-3 max-h-52 space-y-2 overflow-y-auto">
            {detail.comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No comments yet.</p>
            ) : (
              detail.comments.map((c) => (
                <div key={c.id} className="rounded-lg bg-muted/40 p-2">
                  <p className="text-xs font-medium">{c.userName}</p>
                  <p className="text-xs">{c.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{formatDate(c.createdAt)}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment…"
              className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
            />
            <Button type="button" size="sm" disabled={pending || !comment.trim()} onClick={submitComment}>
              Post
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GateRow({
  icon: Icon,
  label,
  active,
  warn,
}: {
  icon: typeof Shield;
  label: string;
  active: boolean;
  warn?: boolean;
}) {
  if (!active) return null;
  return (
    <div className={cn("flex items-center gap-2 rounded-md px-2 py-1", warn ? "bg-red-500/10 text-red-700" : "bg-sky-500/10 text-sky-700")}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}
