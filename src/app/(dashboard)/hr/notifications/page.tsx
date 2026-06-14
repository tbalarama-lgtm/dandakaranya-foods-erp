import { HrPageHeader } from "@/components/hr/hr-page-header";
import { NotificationsClient } from "@/components/hr/notifications-client";
import { MOCK_HR_NOTIFICATIONS } from "@/lib/hr/mock-data";

export default function HrNotificationsPage() {
  return (
    <>
      <HrPageHeader
        title="Notifications & alerts"
        description="Leave approvals, payroll, anniversaries, documents, and shift reminders."
      />
      <NotificationsClient items={MOCK_HR_NOTIFICATIONS} />
    </>
  );
}
