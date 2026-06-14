import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DatabaseSetup } from "@/components/setup/database-setup";
import { isDatabaseReady } from "@/lib/db-health";
import { pingDatabase, runQueriesInBatches, safeCount } from "@/lib/db-connection";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { EMPTY_SIDEBAR_BADGES, type SidebarBadges } from "@/lib/sidebar-badges";

export const dynamic = "force-dynamic";

async function loadSidebarBadges(
  userId: string,
  role: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>["role"],
): Promise<SidebarBadges> {
  if (!(await pingDatabase())) {
    return EMPTY_SIDEBAR_BADGES;
  }

  try {
    const [unreadNotifications, pendingPurchases, newLeads, pendingDocApprovals] =
      await runQueriesInBatches([
        () => safeCount(() => prisma.notification.count({ where: { userId, read: false } })),
        () =>
          can(role, "purchases.view")
            ? safeCount(() => prisma.purchase.count({ where: { approvalStatus: "PENDING" } }))
            : Promise.resolve(0),
        () =>
          can(role, "leads.view")
            ? safeCount(() => prisma.lead.count({ where: { stage: "NEW" } }))
            : Promise.resolve(0),
        () =>
          can(role, "documents.approve")
            ? safeCount(() => prisma.documentApprovalStep.count({ where: { status: "PENDING" } }))
            : Promise.resolve(0),
      ], 2);

    return { unreadNotifications, pendingPurchases, newLeads, pendingDocApprovals };
  } catch {
    return EMPTY_SIDEBAR_BADGES;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const dbReady = await isDatabaseReady();
  const sidebarBadges = dbReady ? await loadSidebarBadges(user.id, user.role) : EMPTY_SIDEBAR_BADGES;

  return (
    <AppShell user={user} sidebarBadges={sidebarBadges}>
      {dbReady ? children : <DatabaseSetup />}
    </AppShell>
  );
}
