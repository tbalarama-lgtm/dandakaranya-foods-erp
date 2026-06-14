import type {
  ProcurementApprovalState,
  ProcurementApprovalType,
  VendorClassification,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { pingDatabase } from "@/lib/db-connection";
import { safeQuery } from "@/lib/prisma-safe";
import { dbRuleToDto, resolveRequiredLevels } from "@/lib/approval-matrix";
import type {
  ApprovalBottleneck,
  ApprovalDetail,
  ApprovalHubKpis,
  ApprovalLevelSnapshot,
  ApprovalMatrixRuleDto,
  ApprovalSlaPoint,
  ApprovalWorkflowRow,
} from "@/lib/approval-types";
import { ALL_APPROVAL_LEVELS } from "@/lib/approval-types";

const WORKFLOW_PO_LIMIT = 40;

type BudgetSnapshot = {
  budgetAmount: number;
  spentAmount: number;
  alertThresholdPct: number;
};

type PurchaseForWorkflow = {
  id: string;
  purchaseNumber: string;
  procurementStage: PurchaseWithApprovals["procurementStage"];
  total: unknown;
  budgetAmount: unknown;
  vendor: {
    id: string;
    name: string;
    classification: VendorClassification;
    seasonalNotes: string | null;
    qualityScore: unknown;
    documents: { expiresAt: Date | null }[];
  };
  branch: { name: string } | null;
  approvals: {
    approvalType: ProcurementApprovalType;
    status: ProcurementApprovalState;
    approvedAt: Date | null;
    dueAt: Date | null;
    createdAt: Date;
    notes: string | null;
    approvedBy: { name: string } | null;
    delegatedTo: { name: string } | null;
  }[];
};

function toNumber(v: unknown): number {
  if (v == null) return 0;
  return Number(v);
}

function hoursSince(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60));
}

function isOverdue(dueAt: Date | null | undefined, status: ProcurementApprovalState): boolean {
  if (!dueAt || status !== "PENDING" && status !== "ESCALATED") return false;
  return dueAt.getTime() < Date.now();
}

async function loadMatrixRules() {
  const rows = await safeQuery(
    () => prisma.approvalMatrixRule.findMany({ where: { active: true } }),
    [],
  );
  return rows.map(dbRuleToDto);
}

async function loadPurchaseContext(purchaseId: string) {
  return prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: {
      vendor: {
        include: {
          documents: { where: { docType: "FSSAI_LICENSE" }, take: 1 },
        },
      },
      branch: { select: { name: true } },
      approvals: {
        include: {
          approvedBy: { select: { name: true } },
          delegatedTo: { select: { name: true } },
        },
      },
      approvalEvents: {
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      approvalComments: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

type PurchaseWithApprovals = NonNullable<Awaited<ReturnType<typeof loadPurchaseContext>>>;

function buildMatrixInputFromPurchase(p: PurchaseForWorkflow) {
  const certDoc = p.vendor.documents[0];
  const certExpiring =
    certDoc?.expiresAt != null && certDoc.expiresAt.getTime() < Date.now() + 30 * 24 * 60 * 60 * 1000;
  const month = new Date().getMonth() + 1;
  const isSeasonal = Boolean(p.vendor.seasonalNotes) || (month >= 4 && month <= 6);

  return {
    total: toNumber(p.total),
    classification: p.vendor.classification,
    department: p.branch?.name ?? null,
    budgetAmount: p.budgetAmount != null ? toNumber(p.budgetAmount) : null,
    isSeasonal,
    requiresQc: p.vendor.classification === "RAW_MATERIAL",
    supplierCertExpiring: certExpiring,
    vendorQualityScore: p.vendor.qualityScore != null ? toNumber(p.vendor.qualityScore) : null,
  };
}

function validateBudgetFromCache(
  total: number,
  classification: VendorClassification,
  budgetAmount: number | null,
  budgetCache: Map<VendorClassification, BudgetSnapshot>,
): { status: "OK" | "ALERT" | "OVERSPEND"; variancePct: number | null; departmentBudget: number | null; departmentSpent: number | null; message: string } {
  const budgetRow = budgetCache.get(classification);
  const departmentBudget = budgetRow?.budgetAmount ?? null;
  const departmentSpent = budgetRow?.spentAmount ?? null;
  const threshold = budgetRow?.alertThresholdPct ?? 90;

  if (budgetAmount != null && total > budgetAmount) {
    const variancePct = budgetAmount > 0 ? ((total - budgetAmount) / budgetAmount) * 100 : 100;
    return {
      status: "OVERSPEND",
      variancePct: Math.round(variancePct * 10) / 10,
      departmentBudget,
      departmentSpent,
      message: `PO exceeds allocated budget by ${Math.round(variancePct)}%`,
    };
  }

  if (departmentBudget != null && departmentSpent != null) {
    const projected = departmentSpent + total;
    const util = departmentBudget > 0 ? (projected / departmentBudget) * 100 : 100;
    if (projected > departmentBudget) {
      return {
        status: "OVERSPEND",
        variancePct: Math.round((util - 100) * 10) / 10,
        departmentBudget,
        departmentSpent,
        message: `Department budget would be exceeded (${Math.round(util)}% utilization)`,
      };
    }
    if (util >= threshold) {
      return {
        status: "ALERT",
        variancePct: Math.round(util * 10) / 10,
        departmentBudget,
        departmentSpent,
        message: `Approaching department budget threshold (${Math.round(util)}%)`,
      };
    }
  }

  return {
    status: "OK",
    variancePct: null,
    departmentBudget,
    departmentSpent,
    message: "Within budget limits",
  };
}

async function loadBudgetCache(): Promise<Map<VendorClassification, BudgetSnapshot>> {
  const now = new Date();
  const fiscalYear = now.getFullYear();
  const month = now.getMonth() + 1;

  const rows = await safeQuery(
    () =>
      prisma.procurementBudget.findMany({
        where: {
          fiscalYear,
          OR: [{ month }, { month: null }],
        },
        orderBy: { month: "desc" },
      }),
    [],
  );

  const cache = new Map<VendorClassification, BudgetSnapshot>();
  for (const row of rows) {
    if (!row.classification || cache.has(row.classification)) continue;
    cache.set(row.classification, {
      budgetAmount: toNumber(row.budgetAmount),
      spentAmount: toNumber(row.spentAmount),
      alertThresholdPct: toNumber(row.alertThresholdPct),
    });
  }
  return cache;
}

const purchaseInclude = {
  vendor: { include: { documents: { where: { docType: "FSSAI_LICENSE" as const }, take: 1 } } },
  branch: { select: { name: true } },
  approvals: {
    include: {
      approvedBy: { select: { name: true } },
      delegatedTo: { select: { name: true } },
    },
  },
} as const;

async function loadPurchasesForWorkflow(): Promise<PurchaseForWorkflow[]> {
  return safeQuery(
    () =>
      prisma.purchase.findMany({
        where: { procurementStage: { not: "CANCELLED" }, approvalStatus: { not: "APPROVED" } },
        include: purchaseInclude,
        orderBy: { purchaseDate: "desc" },
        take: WORKFLOW_PO_LIMIT,
      }),
    [],
  );
}

function buildWorkflowRows(
  purchases: PurchaseForWorkflow[],
  matrixRules: ApprovalMatrixRuleDto[],
  budgetCache: Map<VendorClassification, BudgetSnapshot>,
  opts?: { queue?: "MY_QUEUE" | "OVERDUE" | "ESCALATED" | "ALL" },
): ApprovalWorkflowRow[] {
  const rows: ApprovalWorkflowRow[] = [];

  for (const p of purchases) {
    const input = buildMatrixInputFromPurchase(p);
    const { levels, rule } = resolveRequiredLevels(input, matrixRules);
    const budget = validateBudgetFromCache(
      input.total,
      input.classification,
      input.budgetAmount ?? null,
      budgetCache,
    );
    const row = buildWorkflowRow(p as PurchaseWithApprovals, levels, budget, rule.name);

    if (opts?.queue === "OVERDUE" && row.overdueCount === 0) continue;
    if (opts?.queue === "ESCALATED" && row.escalatedCount === 0) continue;
    if (opts?.queue === "MY_QUEUE" && row.pendingCount === 0) continue;

    rows.push(row);
  }

  return rows;
}

function computeKpisFromRows(rows: ApprovalWorkflowRow[], userId?: string): ApprovalHubKpis {
  let overdue = 0;
  let escalated = 0;
  let blocked = 0;
  let fullyApproved = 0;
  let pendingTotal = 0;
  let budgetAlerts = 0;
  let turnaroundSum = 0;
  let turnaroundCount = 0;
  let slaMet = 0;
  let slaTotal = 0;

  const levelPending: Partial<Record<ProcurementApprovalType, number>> = {};

  for (const r of rows) {
    overdue += r.overdueCount;
    escalated += r.escalatedCount;
    pendingTotal += r.pendingCount;
    if (r.budgetStatus !== "OK") budgetAlerts += 1;
    if (r.levels.some((l) => l.status === "REJECTED")) blocked += 1;
    if (r.progressPct === 100) fullyApproved += 1;

    for (const l of r.levels) {
      if (l.status === "PENDING" || l.status === "ESCALATED") {
        levelPending[l.type] = (levelPending[l.type] ?? 0) + 1;
      }
      if (l.approvedAt && l.dueAt) {
        const approved = new Date(l.approvedAt).getTime();
        const due = new Date(l.dueAt).getTime();
        const created = due - 48 * 60 * 60 * 1000;
        const hours = (approved - created) / (1000 * 60 * 60);
        turnaroundSum += hours;
        turnaroundCount += 1;
        slaTotal += 1;
        if (approved <= due) slaMet += 1;
      }
    }
  }

  const bottleneckLevel =
    (Object.entries(levelPending).sort(([, a], [, b]) => b - a)[0]?.[0] as ProcurementApprovalType) ?? null;

  return {
    totalInWorkflow: rows.length,
    myPending: userId ? pendingTotal : pendingTotal,
    fullyApproved,
    blocked,
    overdue,
    escalated,
    avgTurnaroundHours: turnaroundCount > 0 ? Math.round(turnaroundSum / turnaroundCount) : 0,
    slaCompliancePct: slaTotal > 0 ? Math.round((slaMet / slaTotal) * 100) : 100,
    openValue: rows.reduce((s, r) => s + r.total, 0),
    budgetAlerts,
    bottleneckLevel,
  };
}

function computeBottlenecksFromRows(rows: ApprovalWorkflowRow[]): ApprovalBottleneck[] {
  const map = new Map<ProcurementApprovalType, { pending: number; overdue: number; hours: number[] }>();

  for (const type of ALL_APPROVAL_LEVELS) {
    map.set(type, { pending: 0, overdue: 0, hours: [] });
  }

  for (const r of rows) {
    for (const l of r.levels) {
      const entry = map.get(l.type)!;
      if (l.status === "PENDING" || l.status === "ESCALATED" || l.status === "SENT_BACK") {
        entry.pending += 1;
        if (l.isOverdue) entry.overdue += 1;
        if (r.oldestPendingHours != null) entry.hours.push(r.oldestPendingHours);
      }
    }
  }

  return ALL_APPROVAL_LEVELS.map((level) => {
    const e = map.get(level)!;
    const avgHours = e.hours.length > 0 ? Math.round(e.hours.reduce((a, b) => a + b, 0) / e.hours.length) : 0;
    return { level, pendingCount: e.pending, avgHours, overdueCount: e.overdue };
  }).filter((b) => b.pendingCount > 0);
}

async function loadSlaTrend(): Promise<ApprovalSlaPoint[]> {
  const events = await safeQuery(
    () =>
      prisma.approvalWorkflowEvent.findMany({
        where: { action: "APPROVE", createdAt: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: "asc" },
        take: 200,
      }),
    [],
  );

  const buckets = new Map<string, { hours: number[]; overdue: number; completed: number }>();
  for (const e of events) {
    const d = e.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!buckets.has(key)) buckets.set(key, { hours: [], overdue: 0, completed: 0 });
    const b = buckets.get(key)!;
    b.completed += 1;
    const meta = e.metadata as { turnaroundHours?: number; overdue?: boolean } | null;
    if (meta?.turnaroundHours) b.hours.push(meta.turnaroundHours);
    if (meta?.overdue) b.overdue += 1;
  }

  return [...buckets.entries()].map(([month, b]) => ({
    month,
    avgHours: b.hours.length > 0 ? Math.round(b.hours.reduce((a, c) => a + c, 0) / b.hours.length) : 0,
    overdue: b.overdue,
    completed: b.completed,
  }));
}

/** Single sequential loader for the approvals hub — avoids pool exhaustion on connection_limit=1. */
export async function getApprovalHubBundle(userId?: string) {
  const empty = {
    rows: [] as ApprovalWorkflowRow[],
    kpis: {
      totalInWorkflow: 0,
      myPending: 0,
      fullyApproved: 0,
      blocked: 0,
      overdue: 0,
      escalated: 0,
      avgTurnaroundHours: 0,
      slaCompliancePct: 100,
      openValue: 0,
      budgetAlerts: 0,
      bottleneckLevel: null,
    } satisfies ApprovalHubKpis,
    bottlenecks: [] as ApprovalBottleneck[],
    slaTrend: [] as ApprovalSlaPoint[],
  };

  if (!(await pingDatabase())) return empty;

  const matrixRules = await loadMatrixRules();
  const purchases = await loadPurchasesForWorkflow();
  const budgetCache = await loadBudgetCache();
  const rows = buildWorkflowRows(purchases, matrixRules, budgetCache);
  const slaTrend = await loadSlaTrend();

  return {
    rows,
    kpis: computeKpisFromRows(rows, userId),
    bottlenecks: computeBottlenecksFromRows(rows),
    slaTrend,
  };
}

function mapLevelSnapshots(
  p: PurchaseWithApprovals,
  required: ProcurementApprovalType[],
): ApprovalLevelSnapshot[] {
  return required.map((type) => {
    const a = p.approvals.find((x) => x.approvalType === type);
    const status = a?.status ?? "PENDING";
    return {
      type,
      status,
      approverName: a?.approvedBy?.name ?? a?.delegatedTo?.name ?? null,
      approvedAt: a?.approvedAt?.toISOString() ?? null,
      dueAt: a?.dueAt?.toISOString() ?? null,
      isOverdue: isOverdue(a?.dueAt, status),
      notes: a?.notes ?? null,
    };
  });
}

function buildMatrixInput(p: PurchaseWithApprovals | PurchaseForWorkflow) {
  return buildMatrixInputFromPurchase(p as PurchaseForWorkflow);
}

function buildWorkflowRow(
  p: PurchaseWithApprovals | PurchaseForWorkflow,
  required: ProcurementApprovalType[],
  budget: ReturnType<typeof validateBudgetFromCache>,
  _ruleName: string | null,
): ApprovalWorkflowRow {
  const levels = mapLevelSnapshots(p, required);
  const approved = levels.filter((l) => l.status === "APPROVED").length;
  const pending = levels.filter((l) => l.status === "PENDING" || l.status === "SENT_BACK").length;
  const overdue = levels.filter((l) => l.isOverdue).length;
  const escalated = levels.filter((l) => l.status === "ESCALATED").length;
  const oldest = p.approvals
    .filter((a) => a.status === "PENDING" || a.status === "ESCALATED")
    .map((a) => a.createdAt)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const matrixInput = buildMatrixInput(p);
  const { rule } = resolveRequiredLevels(matrixInput);

  return {
    purchaseId: p.id,
    purchaseNumber: p.purchaseNumber,
    vendorName: p.vendor.name,
    vendorId: p.vendor.id,
    classification: p.vendor.classification,
    department: p.branch?.name ?? null,
    total: toNumber(p.total),
    budgetAmount: p.budgetAmount != null ? toNumber(p.budgetAmount) : null,
    stage: p.procurementStage,
    levels,
    progressPct: required.length > 0 ? Math.round((approved / required.length) * 100) : 0,
    pendingCount: pending,
    overdueCount: overdue,
    escalatedCount: escalated,
    budgetStatus: budget.status,
    budgetVariancePct: budget.variancePct,
    oldestPendingHours: hoursSince(oldest),
    requiresQc: rule.requiresQc,
    requiresCompliance: rule.requiresCompliance,
    isSeasonal: matrixInput.isSeasonal ?? false,
    supplierCertOk: !matrixInput.supplierCertExpiring,
  };
}

export async function ensurePurchaseApprovals(purchaseId: string) {
  const approvalDelegate = (prisma as unknown as Record<string, { upsert?: (args: unknown) => Promise<unknown> }>)
    .procurementApproval;
  if (!approvalDelegate?.upsert) return;

  const p = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: {
      vendor: { include: { documents: { where: { docType: "FSSAI_LICENSE" }, take: 1 } } },
      branch: { select: { name: true } },
    },
  });
  if (!p) return;

  const matrixRules = await loadMatrixRules();
  const input = buildMatrixInput(p as PurchaseWithApprovals);
  const { levels, slaHours } = resolveRequiredLevels(input, matrixRules);
  const dueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000);

  for (const approvalType of levels) {
    await approvalDelegate.upsert({
      where: { purchaseId_approvalType: { purchaseId, approvalType } },
      create: {
        purchaseId,
        approvalType,
        status: "PENDING",
        dueAt,
        slaTargetHours: slaHours,
      },
      update: {},
    });
  }
}

export async function getApprovalWorkflowRows(opts?: {
  userId?: string;
  queue?: "MY_QUEUE" | "OVERDUE" | "ESCALATED" | "ALL";
}): Promise<ApprovalWorkflowRow[]> {
  if (!(await pingDatabase())) return [];

  const matrixRules = await loadMatrixRules();
  const purchases = await loadPurchasesForWorkflow();
  const budgetCache = await loadBudgetCache();
  return buildWorkflowRows(purchases, matrixRules, budgetCache, opts);
}

export async function getApprovalHubKpis(userId?: string): Promise<ApprovalHubKpis> {
  const { kpis } = await getApprovalHubBundle(userId);
  return kpis;
}

export async function getApprovalBottlenecks(): Promise<ApprovalBottleneck[]> {
  const { bottlenecks } = await getApprovalHubBundle();
  return bottlenecks;
}

export async function getApprovalSlaTrend(): Promise<ApprovalSlaPoint[]> {
  if (!(await pingDatabase())) return [];
  return loadSlaTrend();
}

export async function getApprovalDetail(purchaseId: string): Promise<ApprovalDetail | null> {
  const p = await safeQuery(() => loadPurchaseContext(purchaseId), null);
  if (!p) return null;

  const matrixRules = await loadMatrixRules();
  const budgetCache = await loadBudgetCache();
  const input = buildMatrixInput(p);
  const { levels, rule } = resolveRequiredLevels(input, matrixRules);
  const budget = validateBudgetFromCache(
    input.total,
    input.classification,
    input.budgetAmount ?? null,
    budgetCache,
  );
  const row = buildWorkflowRow(p, levels, budget, rule.name);

  return {
    row,
    requiredLevels: levels,
    matrixRuleName: rule.name,
    timeline: p.approvalEvents.map((e) => ({
      id: e.id,
      action: e.action,
      title: e.title,
      detail: e.detail,
      comment: e.comment,
      approvalType: e.approvalType,
      actorName: e.actor?.name ?? null,
      createdAt: e.createdAt.toISOString(),
      metadata: (e.metadata as Record<string, unknown>) ?? null,
    })),
    comments: p.approvalComments.map((c) => ({
      id: c.id,
      body: c.body,
      userName: c.user.name,
      approvalType: c.approvalType,
      createdAt: c.createdAt.toISOString(),
    })),
    budgetAnalysis: {
      poTotal: input.total,
      budgetCap: input.budgetAmount ?? null,
      departmentBudget: budget.departmentBudget,
      departmentSpent: budget.departmentSpent,
      variancePct: budget.variancePct,
      status: budget.status,
      message: budget.message,
    },
  };
}

/** Legacy adapter — returns core level statuses for backward-compatible tables */
export async function getApprovalRows() {
  const rows = await getApprovalWorkflowRows();
  return rows.map((r) => ({
    purchaseId: r.purchaseId,
    purchaseNumber: r.purchaseNumber,
    vendorName: r.vendorName,
    total: r.total,
    stage: r.stage,
    procurement: r.levels.find((l) => l.type === "PROCUREMENT")?.status ?? "PENDING",
    finance: r.levels.find((l) => l.type === "FINANCE")?.status ?? "PENDING",
    inventory: r.levels.find((l) => l.type === "INVENTORY")?.status ?? "PENDING",
    budget: r.levels.find((l) => l.type === "BUDGET")?.status ?? "PENDING",
    progressPct: r.progressPct,
    overdueCount: r.overdueCount,
    budgetStatus: r.budgetStatus,
  }));
}
