"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Info,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { performNotificationAction } from "@/actions/notifications";
import type { NotificationActionType } from "@/lib/notification-types";
import { SEVERITY_STYLES } from "@/lib/notification-types";
import { formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  NotificationCategory,
  NotificationSeverity,
  NotificationStatus,
} from "@prisma/client";

export type NotificationItemData = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  category: NotificationCategory;
  severity: NotificationSeverity;
  status: NotificationStatus;
  actions: { type: string; label: string; href?: string }[];
  createdAt: string;
  escalatedAt: string | null;
};

const SEVERITY_ICON = {
  CRITICAL: ShieldAlert,
  WARNING: AlertTriangle,
  INFO: Info,
  SUCCESS: CheckCircle2,
};

export function NotificationItem({
  item,
  compact = false,
  onAction,
}: {
  item: NotificationItemData;
  compact?: boolean;
  onAction?: () => void;
}) {
  const router = useRouter();
  const styles = SEVERITY_STYLES[item.severity];
  const Icon = SEVERITY_ICON[item.severity];

  const runAction = async (type: NotificationActionType, href?: string) => {
    const result = await performNotificationAction(item.id, type);
    if (!result.ok) {
      toast.error("Action failed");
      return;
    }
    toast.success(`${type.replace("_", " ").toLowerCase()} recorded`);
    onAction?.();
    if (type === "VIEW_DETAILS" && (href || result.link)) {
      router.push(href || result.link || "/notifications");
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "erp-kpi-card relative overflow-hidden border transition",
        styles.border,
        !item.read && "shadow-sm",
        item.read && "opacity-75",
      )}
    >
      <div className={cn("absolute left-0 top-0 h-full w-1", styles.dot)} />
      <div className={cn("p-4", compact && "p-3")}>
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5 rounded-lg p-2", styles.bg)}>
            <Icon className={cn("h-4 w-4", styles.text)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold tracking-tight">{item.title}</p>
              {!item.read && <span className={cn("h-2 w-2 rounded-full", styles.dot)} />}
              {item.status === "ESCALATED" && (
                <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-600">
                  Escalated
                </span>
              )}
            </div>
            <p className={cn("mt-1 text-muted-foreground", compact ? "text-xs line-clamp-2" : "text-sm")}>
              {item.message}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="rounded-md bg-muted px-1.5 py-0.5">{item.category}</span>
              <span className={styles.text}>{item.severity}</span>
              <span>{formatDate(new Date(item.createdAt))}</span>
            </div>

            {item.actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.actions.map((a) => (
                  <Button
                    key={`${item.id}-${a.type}`}
                    type="button"
                    size="sm"
                    variant={
                      a.type === "APPROVE"
                        ? "premium"
                        : a.type === "REJECT"
                          ? "destructive"
                          : "secondary"
                    }
                    className="h-7 text-xs"
                    onClick={() => runAction(a.type as NotificationActionType, a.href)}
                  >
                    {a.label}
                  </Button>
                ))}
                {item.link && (
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" asChild>
                    <Link href={item.link}>
                      Open
                      <ArrowUpRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
