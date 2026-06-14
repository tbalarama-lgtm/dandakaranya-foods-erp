import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });

const prisma = new PrismaClient();
try {
  await prisma.$queryRaw`SELECT 1`;
  const n = await prisma.user.count();
  console.log("OK", { users: n, databaseUrl: process.env.DATABASE_URL?.slice(0, 50) + "..." });
} catch (e) {
  console.error("FAIL", e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
