import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const cols = await prisma.$queryRaw`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'Vendor'
    ORDER BY ordinal_position
  `;
  console.log("Vendor columns:", cols);

  const parsed = {
    name: "Test Vendor",
    phone: "",
    contact: "",
    email: "",
    gstin: "",
    address: "Bastar",
  };
  console.log("Payload ok:", parsed);

  const v = await prisma.vendor.create({
    data: {
      name: parsed.name + " " + Date.now(),
      phone: parsed.phone || null,
      contact: parsed.contact || null,
      email: parsed.email || null,
      gstin: parsed.gstin || null,
      address: parsed.address || null,
    },
  });
  console.log("Created vendor:", v.id);
  await prisma.vendor.delete({ where: { id: v.id } });
  console.log("Cleanup ok");
} catch (e) {
  console.error("FAILED:", e.message);
  if (e.issues) console.error("Zod issues:", e.issues);
} finally {
  await prisma.$disconnect();
}
