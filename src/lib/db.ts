import { PrismaClient } from "@prisma/client";
import { isProcurementVendorSchemaReady } from "@/lib/prisma-schema-ready";

/**
 * Bump when `prisma/schema.prisma` changes so dev picks up a new client after `prisma generate`.
 * (Node may keep an old @prisma/client module until the dev server restarts.)
 */
const PRISMA_SCHEMA_REVISION = "2026-05-production-mes-v1";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaRevision?: string;
  prismaDatabaseUrl?: string;
};

function createPrismaClient() {
  if (!isProcurementVendorSchemaReady()) {
    console.error(
      "[db] Outdated Prisma client (Vendor.status missing). Stop the dev server and run: npm run dev:clean",
    );
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function isClientReady(client: PrismaClient): boolean {
  if (!isProcurementVendorSchemaReady()) return false;
  const p = client as unknown as Record<string, unknown>;
  return Boolean(
    p.vendorContract &&
      p.procurementRFQ &&
      p.goodsReceiptNote &&
      p.procurementApproval &&
      p.procurementBudget &&
      p.gRNItem &&
      p.rFQEvent &&
      p.pOEvent &&
      p.gRNEvent &&
      p.warehouseBin &&
      p.approvalWorkflowEvent &&
      p.approvalComment &&
      p.approvalMatrixRule &&
      p.budgetAuditLog &&
      p.budgetApproval &&
      p.budgetMultiYearPlan &&
      p.inventoryReservation &&
      p.inventoryAdjustment &&
      p.inventoryAuditLog &&
      p.warehouseTransfer &&
      p.pickPackDispatch &&
      p.distributionCenter &&
      p.warehouseZone &&
      p.warehouseTask &&
      p.warehouseAuditLog &&
      p.productionMachine &&
      p.productionWorkOrder &&
      p.productionScheduleSlot &&
      p.productionAuditLog,
  );
}

const databaseUrl = process.env.DATABASE_URL ?? "";

const revisionChanged = globalForPrisma.prismaRevision !== PRISMA_SCHEMA_REVISION;
const databaseUrlChanged =
  globalForPrisma.prismaDatabaseUrl && globalForPrisma.prismaDatabaseUrl !== databaseUrl;

if (globalForPrisma.prisma && (revisionChanged || databaseUrlChanged || !isClientReady(globalForPrisma.prisma))) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const prisma =
  globalForPrisma.prismaRevision === PRISMA_SCHEMA_REVISION &&
  globalForPrisma.prismaDatabaseUrl === databaseUrl &&
  globalForPrisma.prisma &&
  isClientReady(globalForPrisma.prisma)
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaRevision = PRISMA_SCHEMA_REVISION;
  globalForPrisma.prismaDatabaseUrl = databaseUrl;
} else {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaRevision = PRISMA_SCHEMA_REVISION;
  globalForPrisma.prismaDatabaseUrl = databaseUrl;
}

export { isProcurementVendorSchemaReady };
