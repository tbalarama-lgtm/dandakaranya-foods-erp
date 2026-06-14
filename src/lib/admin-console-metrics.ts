import { prisma } from "@/lib/db";

export type AdminConsoleAnalytics = {
  kpis: {
    activeUsers: number;
    adminUsers: number;
    activityToday: number;
    pendingIntegrations: number;
    backupStatus: string;
    systemHealth: "healthy" | "degraded" | "offline";
  };
  recentActivity: {
    id: string;
    action: string;
    entity: string;
    user: string;
    time: string;
  }[];
  roleDistribution: { role: string; count: number }[];
};

export async function getAdminConsoleAnalytics(): Promise<AdminConsoleAnalytics> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [activeUsers, adminUsers, activityToday, recentLogs, roleGroups, integrations] =
    await Promise.all([
      prisma.user.count({ where: { active: true } }),
      prisma.user.count({ where: { role: "ADMIN", active: true } }),
      prisma.activityLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      }),
      prisma.user.groupBy({ by: ["role"], _count: { role: true }, where: { active: true } }),
      prisma.apiIntegration.count({ where: { enabled: false } }),
    ]);

  let systemHealth: AdminConsoleAnalytics["kpis"]["systemHealth"] = "healthy";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    systemHealth = "offline";
  }

  const lastBackup = await prisma.backupLog.findFirst({ orderBy: { createdAt: "desc" } });

  return {
    kpis: {
      activeUsers,
      adminUsers,
      activityToday,
      pendingIntegrations: integrations,
      backupStatus: lastBackup?.status ?? "No backups logged",
      systemHealth,
    },
    recentActivity: recentLogs.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entityType,
      user: l.user?.name ?? "System",
      time: l.createdAt.toLocaleString("en-IN"),
    })),
    roleDistribution: roleGroups.map((g) => ({
      role: g.role.replace(/_/g, " "),
      count: g._count.role,
    })),
  };
}
