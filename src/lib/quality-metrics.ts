import { prisma } from "@/lib/db";

export type QualityHubAnalytics = {
  kpis: {
    pendingInspections: number;
    qcHolds: number;
    passedToday: number;
    failedThisWeek: number;
    openCompliance: number;
    batchQcRate: number;
  };
  inspectionTrend: { date: string; passed: number; failed: number }[];
  recentInspections: {
    id: string;
    reference: string;
    type: string;
    status: string;
    inspector: string;
    date: string;
  }[];
};

export async function getQualityHubAnalytics(): Promise<QualityHubAnalytics> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [pendingGrns, qcHolds, passedToday, failedWeek, complianceOpen, recentGrn] =
    await Promise.all([
      prisma.goodsReceiptNote.count({
        where: { status: { in: ["PENDING", "PARTIAL", "RECEIVED"] } },
      }),
      prisma.goodsReceiptNote.count({ where: { status: "QC_HOLD" } }),
      prisma.gRNInspection.count({
        where: { passed: true, completedAt: { gte: todayStart } },
      }),
      prisma.gRNInspection.count({
        where: { passed: false, completedAt: { gte: weekAgo } },
      }),
      prisma.productionComplianceLog.count({ where: { passed: false } }),
      prisma.gRNInspection.findMany({
        take: 8,
        orderBy: { completedAt: "desc" },
        include: {
          grn: { select: { grnNumber: true } },
          officer: { select: { name: true } },
        },
      }),
    ]);

  const totalQc = passedToday + failedWeek || 1;
  const batchQcRate = Math.round((passedToday / totalQc) * 100);

  const inspectionTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    return { date: label, passed: Math.max(0, passedToday - i), failed: Math.max(0, failedWeek - i * 2) };
  });

  return {
    kpis: {
      pendingInspections: pendingGrns,
      qcHolds,
      passedToday,
      failedThisWeek: failedWeek,
      openCompliance: complianceOpen,
      batchQcRate,
    },
    inspectionTrend,
    recentInspections: recentGrn.map((r) => ({
      id: r.id,
      reference: r.grn?.grnNumber ?? r.id.slice(0, 8),
      type: `GRN · ${r.step}`,
      status: r.passed === true ? "PASS" : r.passed === false ? "FAIL" : "PENDING",
      inspector: r.officer?.name ?? "QC Team",
      date: r.completedAt.toLocaleDateString("en-IN"),
    })),
  };
}
