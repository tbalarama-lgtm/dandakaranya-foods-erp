import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const attendanceColors: Record<string, string> = {
  PRESENT: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  ABSENT: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  LATE: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  HALF_DAY: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  LEAVE: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  HOLIDAY: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
};

const leaveColors: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-700",
  APPROVED: "bg-emerald-500/15 text-emerald-700",
  REJECTED: "bg-rose-500/15 text-rose-700",
  CANCELLED: "bg-slate-500/15 text-slate-600",
};

export function AttendanceStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("border-0 font-medium", attendanceColors[status] ?? "")}>
      {status.replace("_", " ")}
    </Badge>
  );
}

export function LeaveStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("border-0 font-medium", leaveColors[status] ?? "")}>
      {status}
    </Badge>
  );
}

export function EmployeeStatusBadge({ active }: { active: boolean }) {
  return (
    <Badge className={cn("border-0", active ? "bg-emerald-500/15 text-emerald-700" : "bg-slate-500/15")}>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}
