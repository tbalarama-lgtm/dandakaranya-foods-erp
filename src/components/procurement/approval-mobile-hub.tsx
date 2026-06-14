"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import type { ProcurementApprovalType } from "@prisma/client";
import { executeApprovalAction } from "@/actions/approval-workflow";
import type { ApprovalWorkflowRow } from "@/lib/approval-types";
import { APPROVAL_TYPE_LABELS } from "@/lib/approval-types";
import { formatInr } from "@/lib/utils";
import { toast } from "sonner";

export function ApprovalMobileHub({
  rows,
  canEdit,
}: {
  rows: ApprovalWorkflowRow[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const pendingRows = rows.filter((r) => r.pendingCount > 0);

  function quickAction(purchaseId: string, type: ProcurementApprovalType, action: "APPROVE" | "REJECT") {
    startTransition(async () => {
      const res = await executeApprovalAction({ purchaseId, approvalType: type, action });
      if (res.ok) toast.success(action === "APPROVE" ? "Approved" : "Rejected");
      else toast.error(res.error);
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-8">
      <div className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <p className="text-lg font-semibold">Mobile approvals</p>
        <p className="text-xs text-muted-foreground">{pendingRows.length} PO(s) need action</p>
        <Link href="/procurement/approvals" className="text-xs text-[#B68D40] underline">
          Full workflow hub
        </Link>
      </div>

      {pendingRows.length === 0 ? (
        <p className="px-4 text-center text-sm text-muted-foreground">No pending approvals.</p>
      ) : (
        pendingRows.map((r) => {
          const nextLevel = r.levels.find(
            (l) => l.status === "PENDING" || l.status === "ESCALATED" || l.status === "SENT_BACK",
          );
          if (!nextLevel) return null;

          return (
            <div key={r.purchaseId} className="mx-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <Link href={`/procurement/approvals/${r.purchaseId}`} className="font-mono text-sm font-semibold text-[#B68D40]" spellCheck={false}>
                {r.purchaseNumber}
              </Link>
              <p className="mt-1 font-medium">{r.vendorName}</p>
              <p className="text-sm text-muted-foreground">{formatInr(r.total)}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-[#B68D40]" style={{ width: `${r.progressPct}%` }} />
              </div>
              <p className="mt-2 text-xs font-medium">
                Next: {APPROVAL_TYPE_LABELS[nextLevel.type]}
                {nextLevel.isOverdue && <span className="ml-2 text-red-600">· Overdue</span>}
              </p>

              {canEdit && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => quickAction(r.purchaseId, nextLevel.type, "APPROVE")}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => quickAction(r.purchaseId, nextLevel.type, "REJECT")}
                    className="flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white"
                  >
                    <XCircle className="h-5 w-5" />
                    Reject
                  </button>
                  <Link
                    href={`/procurement/approvals/${r.purchaseId}`}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Send back / Escalate / Comment
                  </Link>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
