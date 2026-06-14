import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !can(session.user.role, "activity.export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const header = "Timestamp,User,Action,Entity,Message,IP,User Agent\n";
  const rows = logs
    .map((l) =>
      [
        l.createdAt.toISOString(),
        l.userName ?? "",
        l.action,
        l.entityType,
        `"${l.message.replace(/"/g, '""')}"`,
        l.ipAddress ?? "",
        `"${(l.userAgent ?? "").replace(/"/g, '""')}"`,
      ].join(","),
    )
    .join("\n");

  return new NextResponse(header + rows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="activity-logs-${Date.now()}.csv"`,
    },
  });
}
