import { PrismaClient } from "@prisma/client";

function resolveDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log("DATABASE_MISSING");
    console.log("Set DATABASE_URL in admin-dashboard/.env.local");
    process.exit(1);
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "postgresql:") {
      console.log("DATABASE_INVALID_PROTOCOL");
      process.exit(1);
    }
    if (!parsed.hostname || parsed.hostname === "supabase.com") {
      console.log("DATABASE_INVALID_HOST");
      console.log(
        "DATABASE_URL host looks wrong. Copy the full URI from Supabase → Connect → ORMs → Prisma.",
      );
      process.exit(1);
    }
    console.log(`DATABASE_HOST ${parsed.hostname}:${parsed.port || "5432"}`);
  } catch {
    console.log("DATABASE_MALFORMED");
    process.exit(1);
  }

  return url;
}

const prisma = new PrismaClient({
  datasources: { db: { url: resolveDatabaseUrl() } },
});

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log("DATABASE_OK");
} catch (e) {
  console.log("DATABASE_FAIL");
  console.log(e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
