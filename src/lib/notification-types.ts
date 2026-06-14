import type {
  NotificationCategory,
  NotificationSeverity,
  NotificationStatus,
  UserRole,
} from "@prisma/client";

export type NotificationActionType =
  | "APPROVE"
  | "REJECT"
  | "RESOLVE"
  | "VIEW_DETAILS"
  | "ASSIGN";

export type NotificationActionDef = {
  type: NotificationActionType;
  label: string;
  href?: string;
};

export type NotificationDto = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  category: NotificationCategory;
  severity: NotificationSeverity;
  status: NotificationStatus;
  entityType: string | null;
  entityId: string | null;
  actions: NotificationActionDef[];
  metadata: Record<string, unknown> | null;
  escalatedAt: Date | null;
  resolvedAt: Date | null;
  assignedToId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NotificationTab =
  | "all"
  | "alerts"
  | "approvals"
  | "inventory"
  | "sales"
  | "finance"
  | "production"
  | "hr"
  | "system";

export const NOTIFICATION_TABS: { id: NotificationTab; label: string; category?: NotificationCategory }[] = [
  { id: "all", label: "All" },
  { id: "alerts", label: "Alerts", category: "ALERT" },
  { id: "approvals", label: "Approvals", category: "APPROVAL" },
  { id: "inventory", label: "Inventory", category: "INVENTORY" },
  { id: "sales", label: "Sales", category: "SALES" },
  { id: "finance", label: "Finance", category: "FINANCE" },
  { id: "production", label: "Production", category: "PRODUCTION" },
  { id: "hr", label: "HR", category: "HR" },
  { id: "system", label: "System", category: "SYSTEM" },
];

export const SEVERITY_STYLES: Record<
  NotificationSeverity,
  { border: string; bg: string; text: string; dot: string }
> = {
  CRITICAL: {
    border: "border-red-500/40",
    bg: "bg-red-500/8",
    text: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
  WARNING: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/8",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  INFO: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/8",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  SUCCESS: {
    border: "border-emerald-500/35",
    bg: "bg-emerald-500/8",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
};

export type NotificationPreferenceDto = {
  email: boolean;
  sms: boolean;
  push: boolean;
  criticalOnly: boolean;
  categories: Partial<Record<NotificationCategory, boolean>>;
};

export const DEFAULT_CATEGORY_PREFS: Record<NotificationCategory, boolean> = {
  ALERT: true,
  APPROVAL: true,
  INVENTORY: true,
  SALES: true,
  FINANCE: true,
  PRODUCTION: true,
  HR: true,
  SYSTEM: true,
};

/** Role-based visibility for notification categories */
export const CATEGORY_ROLE_ACCESS: Record<NotificationCategory, UserRole[]> = {
  ALERT: ["ADMIN", "MANAGER", "SALES_EXECUTIVE", "ACCOUNTANT", "HR_EXECUTIVE"],
  APPROVAL: ["ADMIN", "MANAGER", "ACCOUNTANT"],
  INVENTORY: ["ADMIN", "MANAGER", "SALES_EXECUTIVE"],
  SALES: ["ADMIN", "MANAGER", "SALES_EXECUTIVE"],
  FINANCE: ["ADMIN", "MANAGER", "ACCOUNTANT"],
  PRODUCTION: ["ADMIN", "MANAGER"],
  HR: ["ADMIN", "MANAGER", "HR_EXECUTIVE"],
  SYSTEM: ["ADMIN", "MANAGER", "SALES_EXECUTIVE", "ACCOUNTANT", "HR_EXECUTIVE"],
};

export function canViewCategory(role: UserRole, category: NotificationCategory): boolean {
  return CATEGORY_ROLE_ACCESS[category]?.includes(role) ?? false;
}

export type NotificationGroup = "today" | "yesterday" | "this_week" | "older";

export function groupNotificationsByDate(
  items: NotificationDto[],
): { group: NotificationGroup; label: string; items: NotificationDto[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - startOfToday.getDay() * 86400000);

  const buckets: Record<NotificationGroup, NotificationDto[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    older: [],
  };

  for (const item of items) {
    const d = new Date(item.createdAt);
    if (d >= startOfToday) buckets.today.push(item);
    else if (d >= startOfYesterday) buckets.yesterday.push(item);
    else if (d >= startOfWeek) buckets.this_week.push(item);
    else buckets.older.push(item);
  }

  const groups: { group: NotificationGroup; label: string; items: NotificationDto[] }[] = [];
  if (buckets.today.length) groups.push({ group: "today", label: "Today", items: buckets.today });
  if (buckets.yesterday.length)
    groups.push({ group: "yesterday", label: "Yesterday", items: buckets.yesterday });
  if (buckets.this_week.length)
    groups.push({ group: "this_week", label: "This week", items: buckets.this_week });
  if (buckets.older.length) groups.push({ group: "older", label: "Earlier", items: buckets.older });
  return groups;
}

export function tabToCategory(tab: NotificationTab): NotificationCategory | undefined {
  return NOTIFICATION_TABS.find((t) => t.id === tab)?.category;
}

export function parseActions(raw: unknown): NotificationActionDef[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is NotificationActionDef =>
      typeof a === "object" &&
      a !== null &&
      "type" in a &&
      "label" in a &&
      typeof (a as NotificationActionDef).type === "string",
  );
}
