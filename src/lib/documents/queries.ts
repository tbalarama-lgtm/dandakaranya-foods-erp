import type { DocumentDepartment, DocumentFileType, DocumentWorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { departmentFilter } from "./permissions";

export type DocumentListFilters = {
  q?: string;
  department?: DocumentDepartment;
  folderId?: string;
  fileType?: DocumentFileType;
  workflowStatus?: DocumentWorkflowStatus;
  tag?: string;
  expiringOnly?: boolean;
  sharedOnly?: boolean;
  confidentialOnly?: boolean;
  starredOnly?: boolean;
  includeTrash?: boolean;
  archivedOnly?: boolean;
  role: import("@prisma/client").UserRole;
};

function buildWhere(filters: DocumentListFilters) {
  const departments = departmentFilter(filters.role);
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const where: Record<string, unknown> = {};

  if (filters.includeTrash) {
    where.deletedAt = { not: null };
  } else if (filters.archivedOnly) {
    where.archivedAt = { not: null };
    where.deletedAt = null;
  } else {
    where.deletedAt = null;
    where.archivedAt = null;
  }

  if (departments) {
    where.department = { in: departments };
  }

  if (filters.department) {
    where.department = filters.department;
  }

  if (filters.folderId) where.folderId = filters.folderId;
  if (filters.fileType) where.fileType = filters.fileType;
  if (filters.workflowStatus) where.workflowStatus = filters.workflowStatus;
  if (filters.sharedOnly) where.isShared = true;
  if (filters.confidentialOnly) where.classification = "CONFIDENTIAL";
  if (filters.starredOnly) where.isStarred = true;
  if (filters.tag) where.tags = { has: filters.tag };
  if (filters.expiringOnly) {
    where.expiryDate = { lte: thirtyDays, gte: now };
  }

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { fileName: { contains: q, mode: "insensitive" } },
      { documentType: { contains: q, mode: "insensitive" } },
      { employeeRef: { contains: q, mode: "insensitive" } },
      { tags: { has: q } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

const documentInclude = {
  uploadedBy: { select: { id: true, name: true, email: true } },
  folder: { select: { id: true, name: true, slug: true, path: true } },
  approvedBy: { select: { id: true, name: true } },
  _count: { select: { downloads: true, comments: true, versions: true } },
} as const;

export async function listDocuments(filters: DocumentListFilters, take = 50) {
  return prisma.document.findMany({
    where: buildWhere(filters),
    include: documentInclude,
    orderBy: { updatedAt: "desc" },
    take,
  });
}

export async function getDocumentById(id: string) {
  return prisma.document.findUnique({
    where: { id },
    include: {
      ...documentInclude,
      versions: {
        orderBy: { version: "desc" },
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
      comments: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
      approvals: {
        orderBy: { stepOrder: "asc" },
        include: { approver: { select: { id: true, name: true } } },
      },
      downloads: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
}

export async function getVaultMetrics(role: import("@prisma/client").UserRole) {
  const departments = departmentFilter(role);
  const deptFilter = departments ? { department: { in: departments } } : {};
  const base = { deletedAt: null, ...deptFilter };
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    total,
    expiring,
    recent,
    pendingApprovals,
    shared,
    archived,
    storageAgg,
    byDepartment,
  ] = await Promise.all([
    prisma.document.count({ where: { ...base, archivedAt: null } }),
    prisma.document.count({
      where: { ...base, archivedAt: null, expiryDate: { lte: thirtyDays, gte: now } },
    }),
    prisma.document.count({
      where: { ...base, createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.document.count({
      where: { ...base, archivedAt: null, workflowStatus: "UNDER_REVIEW" },
    }),
    prisma.document.count({ where: { ...base, isShared: true } }),
    prisma.document.count({ where: { ...base, archivedAt: { not: null } } }),
    prisma.document.aggregate({ where: base, _sum: { sizeBytes: true } }),
    prisma.document.groupBy({
      by: ["department"],
      where: { ...base, archivedAt: null },
      _count: { id: true },
    }),
  ]);

  return {
    total,
    expiring,
    recent,
    pendingApprovals,
    shared,
    archived,
    storageBytes: storageAgg._sum.sizeBytes ?? 0,
    byDepartment: byDepartment.map((d) => ({
      department: d.department,
      count: d._count.id,
    })),
  };
}

export async function getRecentActivity(role: import("@prisma/client").UserRole, take = 8) {
  const departments = departmentFilter(role);
  return prisma.document.findMany({
    where: {
      deletedAt: null,
      ...(departments ? { department: { in: departments } } : {}),
    },
    include: {
      uploadedBy: { select: { name: true } },
      folder: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function ensureDocumentFolders() {
  const existing = await prisma.documentFolder.count();
  if (existing > 0) return;

  const { DOCUMENT_FOLDER_TREE } = await import("./constants");
  const { seedFolders } = await import("./seed-folders");
  await seedFolders(DOCUMENT_FOLDER_TREE);
}
