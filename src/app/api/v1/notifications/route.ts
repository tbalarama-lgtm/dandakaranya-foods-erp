import { apiHandler, jsonOk } from "@/lib/api/handler";
import {
  getCategoryCounts,
  getNotificationsForUser,
  getUnreadCount,
} from "@/lib/notifications";
import { tabToCategory, type NotificationTab } from "@/lib/notification-types";
import { syncWorkflowNotifications } from "@/lib/notification-rules";
import { prisma } from "@/lib/db";

export const GET = apiHandler(async ({ user }, request) => {
  const { searchParams } = new URL(request.url);
  const tab = (searchParams.get("tab") ?? "all") as NotificationTab;
  const sync = searchParams.get("sync") === "1";

  if (sync) {
    await syncWorkflowNotifications();
  }

  const category = tabToCategory(tab);
  const items = await getNotificationsForUser(user.id, user.role, {
    category,
    limit: 100,
  });

  const [unread, counts] = await Promise.all([
    getUnreadCount(user.id, user.role),
    getCategoryCounts(user.id, user.role),
  ]);

  return jsonOk({
    items: items.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      escalatedAt: i.escalatedAt?.toISOString() ?? null,
      resolvedAt: i.resolvedAt?.toISOString() ?? null,
    })),
    unread,
    counts,
  });
});

export const POST = apiHandler(async ({ user }, request) => {
  const body = await request.json().catch(() => ({}));
  if (body.action === "sync") {
    const count = await syncWorkflowNotifications();
    return jsonOk({ ok: true, count });
  }

  if (body.action === "mark_all_read") {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return jsonOk({ ok: true });
  }

  return jsonOk({ ok: false });
});
