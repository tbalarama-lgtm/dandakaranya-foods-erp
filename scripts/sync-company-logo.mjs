/**
 * Sets company profile logoUrl to the production brand logo.
 * Run: node scripts/sync-company-logo.mjs
 */
import { PrismaClient } from "@prisma/client";

const LOGO_URL = "https://dandakaranyafoods.com/logo.png";
const prisma = new PrismaClient();

await prisma.companyProfile.upsert({
  where: { id: 1 },
  update: { logoUrl: LOGO_URL },
  create: {
    id: 1,
    name: "Dandakaranya Foods",
    legalName: "Dandakaranya Foods",
    tagline: "Forest Heritage · Export Quality",
    address: "Nursery Park Road, Sukma District, Chhattisgarh, India",
    phone: "+91 9949233777",
    email: "dandakaranyafoods@gmail.com",
    gstin: "22AAAAA0000A1Z5",
    website: "https://dandakaranyafoods.com",
    logoUrl: LOGO_URL,
  },
});

console.log("Company logo URL set to", LOGO_URL);
await prisma.$disconnect();
