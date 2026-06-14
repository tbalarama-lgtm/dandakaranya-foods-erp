import { PageHeader } from "@/components/layout/page-header";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { getCategoryCounts, getUnreadCount } from "@/lib/notifications";
import { syncWorkflowNotifications } from "@/lib/notification-rules";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  await syncWorkflowNotifications().catch(() => undefined);

  const [unread, counts] = await Promise.all([
    getUnreadCount(user.id, user.role),
    getCategoryCounts(user.id, user.role),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alert & workflow center"
        description="Enterprise notifications · approvals · inventory · production · HR · live updates"
      />
      <NotificationCenter initialUnread={unread} initialCounts={counts} />
    </div>
  );
}
