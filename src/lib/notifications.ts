import type {
  NotificationCategory,
  NotificationSeverity,
  UserRole,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { NotificationActionDef, NotificationDto } from "@/lib/notification-types";
import { canViewCategory, parseActions } from "@/lib/notification-types";

export type UpsertNotificationInput = {
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  link?: string;
  entityType?: string;
  entityId?: string;
  ruleKey?: string;
  actions?: NotificationActionDef[];
  metadata?: Record<string, unknown>;
};

function toDto(row: {
  id: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  category: NotificationCategory;
  severity: NotificationSeverity;
  status: import("@prisma/client").NotificationStatus;
  entityType: string | null;
  entityId: string | null;
  actions: unknown;
  metadata: unknown;
  escalatedAt: Date | null;
  resolvedAt: Date | null;
  assignedToId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): NotificationDto {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    read: row.read,
    link: row.link,
    category: row.category,
    severity: row.severity,
    status: row.status,
    entityType: row.entityType,
    entityId: row.entityId,
    actions: parseActions(row.actions),
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    escalatedAt: row.escalatedAt,
    resolvedAt: row.resolvedAt,
    assignedToId: row.assignedToId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function upsertNotification(input: UpsertNotificationInput) {
  const data = {
    title: input.title,
    message: input.message,
    category: input.category,
    severity: input.severity,
    link: input.link ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    actions: (input.actions ?? []) as Prisma.InputJsonValue,
    metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    read: false,
    status: "OPEN" as const,
  };

  if (input.ruleKey) {
    return prisma.notification.upsert({
      where: { userId_ruleKey: { userId: input.userId, ruleKey: input.ruleKey } },
      create: { userId: input.userId, ruleKey: input.ruleKey, ...data },
      update: { ...data, updatedAt: new Date() },
    });
  }

  return prisma.notification.create({
    data: { userId: input.userId, ...data },
  });
}

export async function getNotificationsForUser(
  userId: string,
  role: UserRole,
  opts?: { category?: NotificationCategory; unreadOnly?: boolean; limit?: number },
): Promise<NotificationDto[]> {
  const rows = await prisma.notification.findMany({
    where: {
      userId,
      ...(opts?.unreadOnly ? { read: false } : {}),
      ...(opts?.category ? { category: opts.category } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 100,
  });

  return rows.filter((r) => canViewCategory(role, r.category)).map(toDto);
}

export async function getUnreadCount(userId: string, role: UserRole): Promise<number> {
  const rows = await prisma.notification.findMany({
    where: { userId, read: false, status: { in: ["OPEN", "ESCALATED"] } },
    select: { category: true },
  });
  return rows.filter((r) => canViewCategory(role, r.category)).length;
}

export async function getCategoryCounts(
  userId: string,
  role: UserRole,
): Promise<Record<string, number>> {
  const rows = await prisma.notification.groupBy({
    by: ["category"],
    where: { userId, read: false, status: { in: ["OPEN", "ESCALATED"] } },
    _count: true,
  });

  const counts: Record<string, number> = { all: 0 };
  for (const row of rows) {
    if (!canViewCategory(role, row.category)) continue;
    counts[row.category.toLowerCase()] = row._count;
    counts.all += row._count;
  }
  return counts;
}

export async function getLatestNotificationTimestamp(userId: string): Promise<Date | null> {
  const latest = await prisma.notification.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  return latest?.updatedAt ?? null;
}

export async function getNotificationPreferences(userId: string) {
  let pref = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (!pref) {
    pref = await prisma.notificationPreference.create({ data: { userId } });
  }
  return pref;
}

export async function getAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", active: true },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

export async function getUsersByRoles(roles: UserRole[]): Promise<{ id: string; role: UserRole }[]> {
  return prisma.user.findMany({
    where: { role: { in: roles }, active: true },
    select: { id: true, role: true },
  });
}

export { toDto };
