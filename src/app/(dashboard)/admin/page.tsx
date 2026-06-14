import { PageHeader } from "@/components/layout/page-header";
import { AdminConsolePlatform } from "@/components/admin/admin-console-platform";
import { getAdminConsoleAnalytics } from "@/lib/admin-console-metrics";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminConsolePage() {
  await requirePermission("users.manage");
  const analytics = await getAdminConsoleAnalytics();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Console"
        description="Users · roles · audit logs · company profile · integrations · system health for Dandakaranya Foods ERP"
      />
      <AdminConsolePlatform analytics={analytics} />
    </div>
  );
}
