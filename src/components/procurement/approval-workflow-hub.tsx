"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  Eye,
  MessageSquare,
  Search,
  ShieldAlert,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import type { ProcurementApprovalType } from "@prisma/client";
import { executeApprovalAction } from "@/actions/approval-workflow";
import type {
  ApprovalBottleneck,
  ApprovalHubKpis,
  ApprovalSlaPoint,
  ApprovalWorkflowRow,
} from "@/lib/approval-types";
import {
  APPROVAL_STATE_LABELS,
  APPROVAL_STATE_STYLES,
  APPROVAL_TYPE_LABELS,
} from "@/lib/approval-types";
import { LIFECYCLE_LABELS, LIFECYCLE_STYLES } from "@/lib/procurement-types";
import { Button } from "@/components/ui/button";
import { formatInr, cn, formatDate } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type QueueTab = "ALL" | "MY_QUEUE" | "OVERDUE" | "ESCALATED";

export function ApprovalWorkflowHub({
  rows,
  kpis,
  bottlenecks,
  slaTrend,
  canEdit,
}: {
  rows: ApprovalWorkflowRow[];
  kpis: ApprovalHubKpis;
  bottlenecks: ApprovalBottleneck[];
  slaTrend: ApprovalSlaPoint[];
  canEdit: boolean;
}) {
  const [q, setQ] = useState("");
  const [queue, setQueue] = useState<QueueTab>("ALL");
  const [pending, startTransition] = useTransition();
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    let list = [...rows];
    if (queue === "OVERDUE") list = list.filter((r) => r.overdueCount > 0);
    if (queue === "ESCALATED") list = list.filter((r) => r.escalatedCount > 0);
    if (queue === "MY_QUEUE") list = list.filter((r) => r.pendingCount > 0);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(
        (r) =>
          r.purchaseNumber.toLowerCase().includes(s) ||
          r.vendorName.toLowerCase().includes(s) ||
          (r.department?.toLowerCase().includes(s) ?? false),
      );
    }
    return list;
  }, [rows, q, queue]);

  function runAction(
    purchaseId: string,
    approvalType: ProcurementApprovalType,
    action: "APPROVE" | "REJECT" | "SEND_BACK" | "ESCALATE",
  ) {
    const key = `${purchaseId}-${approvalType}`;
    const comment = commentDraft[key];
    startTransition(async () => {
      const res = await executeApprovalAction({ purchaseId, approvalType, action, comment });
      if (res.ok) {
        toast.success(`${action.replace("_", " ")} recorded`);
        setCommentDraft((d) => ({ ...d, [key]: "" }));
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={ClipboardCheck} label="In workflow" value={String(kpis.totalInWorkflow)} sub={`${kpis.myPending} pending sign-offs`} />
        <Kpi icon={Clock} label="Overdue / SLA" value={`${kpis.overdue} / ${kpis.slaCompliancePct}%`} sub={`Avg ${kpis.avgTurnaroundHours}h turnaround`} />
        <Kpi icon={Zap} label="Escalated" value={String(kpis.escalated)} sub={`${kpis.blocked} blocked · ${kpis.budgetAlerts} budget alerts`} />
        <Kpi icon={TrendingUp} label="Open value" value={formatInr(kpis.openValue)} sub={kpis.bottleneckLevel ? `Bottleneck: ${APPROVAL_TYPE_LABELS[kpis.bottleneckLevel]}` : "No bottleneck"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 p-4">
          <p className="mb-3 text-sm font-medium">Approval SLA trend</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={slaTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="avgHours" stroke="#B68D40" name="Avg hours" strokeWidth={2} />
                <Line type="monotone" dataKey="overdue" stroke="#ef4444" name="Overdue" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <p className="mb-3 text-sm font-medium">Bottleneck analytics</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bottlenecks.map((b) => ({ name: APPROVAL_TYPE_LABELS[b.level].slice(0, 8), pending: b.pendingCount, overdue: b.overdueCount }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="pending" fill="#B68D40" name="Pending" radius={[4, 4, 0, 0]} />
                <Bar dataKey="overdue" fill="#ef4444" name="Overdue" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "MY_QUEUE", "OVERDUE", "ESCALATED"] as QueueTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setQueue(tab)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              queue === tab ? "bg-[#B68D40] text-white" : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {tab === "ALL" ? "All queues" : tab.replace("_", " ").toLowerCase()}
          </button>
        ))}
        <Button type="button" size="sm" variant="outline" asChild className="ml-auto">
          <Link href="/procurement/approvals/mobile">
            Mobile approvals
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search PO #, vendor, department…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm"
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            No purchase orders in this approval queue.
          </div>
        ) : (
          filtered.map((r) => (
            <motion.div
              key={r.purchaseId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/procurement/approvals/${r.purchaseId}`}
                      className="font-mono text-sm font-semibold text-[#B68D40] hover:underline"
                      spellCheck={false}
                    >
                      {r.purchaseNumber}
                    </Link>
                    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", LIFECYCLE_STYLES[r.stage])}>
                      {LIFECYCLE_LABELS[r.stage]}
                    </span>
                    {r.budgetStatus !== "OK" && (
                      <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", r.budgetStatus === "OVERSPEND" ? "bg-red-500/12 text-red-700" : "bg-amber-500/12 text-amber-800")}>
                        Budget {r.budgetStatus.toLowerCase()}
                      </span>
                    )}
                    {r.overdueCount > 0 && (
                      <span className="flex items-center gap-1 rounded-md bg-red-500/12 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        <AlertTriangle className="h-3 w-3" />
                        {r.overdueCount} overdue
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium">{r.vendorName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatInr(r.total)} · {r.department ?? "General"} · {r.classification.replace("_", " ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{r.progressPct}%</p>
                  <p className="text-[11px] text-muted-foreground">workflow complete</p>
                  <div className="mt-2 h-2 w-32 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[#B68D40] transition-all" style={{ width: `${r.progressPct}%` }} />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1">
                {r.requiresQc && <Badge icon={ShieldAlert} label="QC gate" />}
                {r.requiresCompliance && <Badge icon={CheckCircle2} label="Compliance" />}
                {r.isSeasonal && <Badge icon={Clock} label="Seasonal" />}
                {!r.supplierCertOk && <Badge icon={XCircle} label="Cert review" warn />}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {r.levels.map((level) => (
                  <LevelCard
                    key={level.type}
                    row={r}
                    level={level}
                    canEdit={canEdit}
                    pending={pending}
                    comment={commentDraft[`${r.purchaseId}-${level.type}`] ?? ""}
                    onCommentChange={(v) =>
                      setCommentDraft((d) => ({ ...d, [`${r.purchaseId}-${level.type}`]: v }))
                    }
                    onAction={(action) => runAction(r.purchaseId, level.type, action)}
                  />
                ))}
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" asChild>
                  <Link href={`/procurement/approvals/${r.purchaseId}`}>
                    <MessageSquare className="mr-1 h-4 w-4" />
                    Timeline & discussion
                  </Link>
                </Button>
                <Button type="button" size="sm" variant="ghost" asChild>
                  <Link href={`/purchases/${r.purchaseId}`}>
                    <Eye className="mr-1 h-4 w-4" />
                    PO detail
                  </Link>
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function LevelCard({
  level,
  canEdit,
  pending,
  comment,
  onCommentChange,
  onAction,
}: {
  row: ApprovalWorkflowRow;
  level: ApprovalWorkflowRow["levels"][number];
  canEdit: boolean;
  pending: boolean;
  comment: string;
  onCommentChange: (v: string) => void;
  onAction: (action: "APPROVE" | "REJECT" | "SEND_BACK" | "ESCALATE") => void;
}) {
  const actionable =
    canEdit &&
    (level.status === "PENDING" || level.status === "ESCALATED" || level.status === "SENT_BACK");

  return (
    <div className={cn("rounded-lg border p-2.5", level.isOverdue ? "border-red-500/40 bg-red-500/5" : "border-border/50 bg-muted/30")}>
      <div className="flex items-center justify-between gap-1">
        <p className="text-[11px] font-semibold">{APPROVAL_TYPE_LABELS[level.type]}</p>
        <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold", APPROVAL_STATE_STYLES[level.status])}>
          {APPROVAL_STATE_LABELS[level.status]}
        </span>
      </div>
      {level.approverName && <p className="mt-1 text-[10px] text-muted-foreground">{level.approverName}</p>}
      {level.dueAt && (
        <p className="text-[10px] text-muted-foreground">Due {formatDate(level.dueAt)}</p>
      )}
      {actionable && (
        <div className="mt-2 space-y-1.5">
          <input
            type="text"
            placeholder="Comment (optional)"
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            className="h-7 w-full rounded border border-border bg-background px-2 text-[10px]"
          />
          <div className="flex flex-wrap gap-1">
            <ActionBtn label="Approve" color="emerald" disabled={pending} onClick={() => onAction("APPROVE")} />
            <ActionBtn label="Reject" color="red" disabled={pending} onClick={() => onAction("REJECT")} />
            <ActionBtn label="Send back" color="orange" disabled={pending} onClick={() => onAction("SEND_BACK")} />
            <ActionBtn label="Escalate" color="violet" disabled={pending} onClick={() => onAction("ESCALATE")} />
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  label,
  color,
  disabled,
  onClick,
}: {
  label: string;
  color: "emerald" | "red" | "orange" | "violet";
  disabled: boolean;
  onClick: () => void;
}) {
  const styles = {
    emerald: "text-emerald-700 hover:bg-emerald-500/10",
    red: "text-red-700 hover:bg-red-500/10",
    orange: "text-orange-700 hover:bg-orange-500/10",
    violet: "text-violet-700 hover:bg-violet-500/10",
  };
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cn("rounded px-1.5 py-0.5 text-[9px] font-medium", styles[color])}>
      {label}
    </button>
  );
}

function Badge({ icon: Icon, label, warn }: { icon: typeof ShieldAlert; label: string; warn?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium", warn ? "bg-red-500/12 text-red-700" : "bg-sky-500/12 text-sky-700")}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
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
