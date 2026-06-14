import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  PAID: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  PENDING: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  PARTIAL: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  OVERDUE: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  APPROVED: "bg-emerald-500/15 text-emerald-700",
  REJECTED: "bg-rose-500/15 text-rose-700",
};

export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="muted" className={cn("border-0 font-medium normal-case", styles[status] ?? "")}>
      {status}
    </Badge>
  );
}
