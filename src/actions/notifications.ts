"use server";

import { revalidatePath } from "next/cache";
import { ActivityAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getCurrentUser } from "@/lib/session";
import type { NotificationActionType } from "@/lib/notification-types";
import {
  DEFAULT_CATEGORY_PREFS,
  type NotificationPreferenceDto,
} from "@/lib/notification-types";
import { syncWorkflowNotifications } from "@/lib/notification-rules";

function revalidateNotificationPaths() {
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markNotificationRead(id: string) {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  });

  revalidateNotificationPaths();
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });

  revalidateNotificationPaths();
}

export async function performNotificationAction(
  id: string,
  action: NotificationActionType,
  metadata?: Record<string, unknown>,
) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Unauthorized" };

  const notification = await prisma.notification.findFirst({
    where: { id, userId: user.id },
  });
  if (!notification) return { ok: false as const, error: "Not found" };

  const now = new Date();
  const updates: { read?: boolean; status?: "RESOLVED" | "OPEN"; resolvedAt?: Date | null } = {};

  if (action === "RESOLVE" || action === "APPROVE" || action === "REJECT") {
    updates.status = "RESOLVED";
    updates.resolvedAt = now;
    updates.read = true;
  } else if (action === "VIEW_DETAILS") {
    updates.read = true;
  }

  if (Object.keys(updates).length) {
    await prisma.notification.update({
      where: { id },
      data: updates,
    });
  }

  await prisma.notificationActionLog.create({
    data: {
      notificationId: id,
      userId: user.id,
      action,
      metadata: (metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  await logActivity({
    userId: user.id,
    action: ActivityAction.NOTIFICATION_ACTION,
    entityType: "Notification",
    entityId: id,
    message: `Notification action: ${action} on "${notification.title}"`,
    metadata: { action, notificationId: id, ...metadata },
  });

  revalidateNotificationPaths();
  return { ok: true as const, link: notification.link };
}

export async function assignNotification(id: string, assigneeId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Unauthorized" };

  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { assignedToId: assigneeId, read: false },
  });

  await prisma.notificationActionLog.create({
    data: {
      notificationId: id,
      userId: user.id,
      action: "ASSIGN",
      metadata: { assigneeId },
    },
  });

  await logActivity({
    userId: user.id,
    action: ActivityAction.NOTIFICATION_ACTION,
    entityType: "Notification",
    entityId: id,
    message: `Notification assigned to user ${assigneeId}`,
    metadata: { assigneeId },
  });

  revalidateNotificationPaths();
  return { ok: true as const };
}

export async function syncNotificationsAction() {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, count: 0 };

  const count = await syncWorkflowNotifications();
  revalidateNotificationPaths();
  return { ok: true as const, count };
}

export async function updateNotificationPreferences(prefs: NotificationPreferenceDto) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const };

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      email: prefs.email,
      sms: prefs.sms,
      push: prefs.push,
      criticalOnly: prefs.criticalOnly,
      categories: prefs.categories,
    },
    update: {
      email: prefs.email,
      sms: prefs.sms,
      push: prefs.push,
      criticalOnly: prefs.criticalOnly,
      categories: prefs.categories,
    },
  });

  await logActivity({
    userId: user.id,
    action: ActivityAction.UPDATE,
    entityType: "NotificationPreference",
    message: "Updated notification delivery preferences",
    metadata: prefs,
  });

  revalidatePath("/notifications");
  return { ok: true as const };
}

export async function getNotificationPreferencesAction(): Promise<NotificationPreferenceDto> {
  const user = await getCurrentUser();
  if (!user) {
    return { email: true, sms: false, push: true, criticalOnly: false, categories: DEFAULT_CATEGORY_PREFS };
  }

  const pref = await prisma.notificationPreference.findUnique({ where: { userId: user.id } });
  if (!pref) {
    return { email: true, sms: false, push: true, criticalOnly: false, categories: DEFAULT_CATEGORY_PREFS };
  }

  return {
    email: pref.email,
    sms: pref.sms,
    push: pref.push,
    criticalOnly: pref.criticalOnly,
    categories: { ...DEFAULT_CATEGORY_PREFS, ...(pref.categories as object) },
  };
}
