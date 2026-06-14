import { prisma } from "./db";
import { isPoExecutionClientSchemaReady } from "./prisma-schema-ready";

export async function isDatabaseReady() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url || url.includes("[YOUR-PASSWORD]") || url.includes("localhost:5432")) {
    return false;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    try {
      await prisma.user.count();
      return true;
    } catch {
      return false;
    }
  }
}

/** True when PO execution columns (poStatus, etc.) exist in the live database. */
export async function isPoExecutionDbSchemaReady(): Promise<boolean> {
  if (!isPoExecutionClientSchemaReady()) return false;

  try {
    const rows = await prisma.$queryRaw<Array<{ ok: number }>>`
      SELECT 1 as ok
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Purchase'
        AND column_name = 'poStatus'
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}
