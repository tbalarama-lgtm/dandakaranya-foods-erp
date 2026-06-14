import { PrismaClient } from "@prisma/client";

const label = process.argv[2] ?? "DATABASE_URL";
const url = process.env[label];

if (!url) {
  console.log(`${label}_MISSING`);
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url } },
});

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log(`${label}_OK`);
} catch (e) {
  console.log(`${label}_FAIL`);
  console.log(e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
