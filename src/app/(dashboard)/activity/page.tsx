import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ActivityFilters } from "@/components/activity/activity-filters";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { requirePermission } from "@/lib/session";
import { ActivityAction } from "@prisma/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string }>;
}) {
  await requirePermission("activity.view");
  const { q, action } = await searchParams;

  const logs = await prisma.activityLog.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { message: { contains: q, mode: "insensitive" } },
                { userName: { contains: q, mode: "insensitive" } },
                { entityType: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        action && Object.values(ActivityAction).includes(action as ActivityAction)
          ? { action: action as ActivityAction }
          : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader
        title="Activity logs"
        description="Audit trail — logins, invoices, leads, inventory, deletions"
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading filters…</p>}>
          <ActivityFilters />
        </Suspense>
        <Button variant="secondary" asChild>
          <Link href="/api/activity/export">Export CSV</Link>
        </Button>
      </div>
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {logs.length === 0 ? (
            <p className="p-6 text-muted-foreground">No activity logs match your filters.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex flex-wrap gap-3 px-4 py-3 text-sm">
                <Badge variant="muted">{log.action}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{log.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.userName ?? "System"} · {log.entityType}
                    {log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ""} · {formatDate(log.createdAt)}
                  </p>
                  {(log.ipAddress || log.userAgent) && (
                    <p className="text-[10px] text-muted-foreground">
                      {log.ipAddress}
                      {log.userAgent ? ` · ${log.userAgent.slice(0, 60)}…` : ""}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
