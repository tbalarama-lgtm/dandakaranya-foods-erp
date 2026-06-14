import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-700",
  IN_PROGRESS: "bg-blue-500/15 text-blue-700",
  COMPLETED: "bg-emerald-500/15 text-emerald-700",
  PLANNED: "bg-slate-500/15 text-slate-600",
  PENDING: "bg-amber-500/15 text-amber-700",
  DELAYED: "bg-rose-500/15 text-rose-700",
  CANCELLED: "bg-slate-500/15 text-slate-500",
  MAINTENANCE: "bg-amber-500/15 text-amber-700",
  OFFLINE: "bg-slate-500/15 text-slate-600",
  BREAKDOWN: "bg-rose-500/15 text-rose-700",
  PASS: "bg-emerald-500/15 text-emerald-700",
  FAIL: "bg-rose-500/15 text-rose-700",
  HOLD: "bg-amber-500/15 text-amber-700",
  HIGH: "bg-rose-500/15 text-rose-700",
  URGENT: "bg-rose-600/20 text-rose-800",
  MEDIUM: "bg-amber-500/15 text-amber-700",
  LOW: "bg-slate-500/15 text-slate-600",
  RELEASED: "bg-sky-500/15 text-sky-700",
  QC: "bg-violet-500/15 text-violet-700",
  REJECTED: "bg-rose-500/15 text-rose-700",
  IDLE: "bg-slate-400/15 text-slate-600",
};

export function ProductionStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="muted" className={cn("border-0 font-medium normal-case", statusStyles[status] ?? "")}>
      {status.replace("_", " ")}
    </Badge>
  );
}
