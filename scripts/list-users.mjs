import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, active: true },
    orderBy: { email: "asc" },
  });
  console.log("Users:", users);
  console.log("Vendor count:", await prisma.vendor.count());
} finally {
  await prisma.$disconnect();
}
