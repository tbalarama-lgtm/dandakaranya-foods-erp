import { PageHeader } from "@/components/layout/page-header";
import { InviteUserDialog } from "@/components/users/invite-user-dialog";
import { UserActiveToggle, UserRoleSelect } from "@/components/users/user-row-actions";
import { KpiStatRow } from "@/components/shared/kpi-stat-row";
import { Badge } from "@/components/ui/badge";
import {
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
} from "@/components/shared/data-table";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { requirePermission } from "@/lib/session";
import { ShieldCheck, UserCheck, Users, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const admin = await requirePermission("users.manage");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  const activeCount = users.filter((u) => u.active).length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const recentLoginCount = users.filter((u) => {
    if (!u.lastLoginAt) return false;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return u.lastLoginAt.getTime() >= weekAgo;
  }).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Users & roles"
        description="Invite team members and manage ERP access"
        actions={<InviteUserDialog />}
      />

      <KpiStatRow
        items={[
          {
            label: "Total users",
            value: users.length,
            sub: "Registered accounts",
            icon: Users,
            accent: "gold",
          },
          {
            label: "Active",
            value: activeCount,
            sub: `${users.length - activeCount} disabled`,
            icon: UserCheck,
            accent: "emerald",
          },
          {
            label: "Administrators",
            value: adminCount,
            sub: "Full system access",
            icon: ShieldCheck,
            accent: "violet",
          },
          {
            label: "Recent logins",
            value: recentLoginCount,
            sub: "Last 7 days",
            icon: Clock,
            accent: "blue",
          },
        ]}
      />

      <DataTableShell>
        <DataTableHead>
          <tr>
            <DataTableHeaderCell>Name</DataTableHeaderCell>
            <DataTableHeaderCell>Email</DataTableHeaderCell>
            <DataTableHeaderCell>Role</DataTableHeaderCell>
            <DataTableHeaderCell>Status</DataTableHeaderCell>
            <DataTableHeaderCell>Last login</DataTableHeaderCell>
            <DataTableHeaderCell>Actions</DataTableHeaderCell>
          </tr>
        </DataTableHead>
        <DataTableBody>
          {users.map((u) => {
            const isSelf = u.id === admin.id;
            return (
              <DataTableRow key={u.id}>
                <DataTableCell className="font-medium">
                  {u.name}
                  {isSelf && (
                    <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                  )}
                </DataTableCell>
                <DataTableCell className="text-muted-foreground">{u.email}</DataTableCell>
                <DataTableCell>
                  <UserRoleSelect userId={u.id} role={u.role} disabled={isSelf} />
                </DataTableCell>
                <DataTableCell>
                  <Badge variant={u.active ? "success" : "danger"}>{u.active ? "Active" : "Disabled"}</Badge>
                </DataTableCell>
                <DataTableCell className="text-muted-foreground">
                  {u.lastLoginAt ? formatDate(u.lastLoginAt) : "—"}
                </DataTableCell>
                <DataTableCell>
                  <UserActiveToggle userId={u.id} active={u.active} disabled={isSelf} />
                </DataTableCell>
              </DataTableRow>
            );
          })}
        </DataTableBody>
      </DataTableShell>
    </div>
  );
}
