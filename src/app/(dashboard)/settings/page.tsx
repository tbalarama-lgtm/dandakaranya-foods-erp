import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePermission } from "@/lib/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePermission("settings.manage");

  const [userCount, productCount, logCount] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.activityLog.count(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="System preferences, security, and integrations" />

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-semibold">{userCount}</p>
            <p className="text-sm text-muted-foreground">Active ERP accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-semibold">{productCount}</p>
            <p className="text-sm text-muted-foreground">SKUs in catalogue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Audit trail</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-semibold">{logCount}</p>
            <p className="text-sm text-muted-foreground">Activity log entries</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Session & security
            <Badge variant="success">Active</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Sessions expire after 8 hours. All sign-ins and changes are recorded in Activity logs.</p>
          <p>Use strong passwords and rotate Supabase database credentials periodically.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Database & backups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Production data is hosted on <strong className="text-foreground">Supabase PostgreSQL</strong> (project
            nxolzqydwieraygfzvjj).
          </p>
          <p>Use Supabase Dashboard → Database → Backups for scheduled snapshots.</p>
          <p>Export activity logs anytime from the Activity page (CSV).</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <span>SMTP email alerts</span>
            <Badge variant="muted">Planned</Badge>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <span>WhatsApp order notifications</span>
            <Badge variant="muted">Planned</Badge>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <span>Shop catalogue sync (Supabase API)</span>
            <Badge variant="success">Available</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
