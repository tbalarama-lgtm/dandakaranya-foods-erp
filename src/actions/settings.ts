"use server";

import { revalidatePath } from "next/cache";
import { ActivityAction } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/session";
import { BRAND_LOGO_HTTPS_URL } from "@/lib/brand-logo";
import { normalizeLogoUrl } from "@/lib/logo-url";

export async function updateCompany(data: {
  name: string;
  legalName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  website: string;
  logoUrl?: string;
}) {
  const user = await requirePermission("company.manage");
  const logoUrl = normalizeLogoUrl(data.logoUrl?.trim() || BRAND_LOGO_HTTPS_URL);
  const payload = { ...data, logoUrl };
  await prisma.companyProfile.upsert({
    where: { id: 1 },
    update: payload,
    create: { id: 1, ...payload },
  });
  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.UPDATE,
    entityType: "CompanyProfile",
    message: "Updated company profile",
  });
  revalidatePath("/company");
}
