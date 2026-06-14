import { prisma } from "@/lib/db";

/** Multi-company tenant context — defaults to the primary organization. */
export async function getDefaultOrganization() {
  return (
    (await prisma.organization.findFirst({ where: { isDefault: true, isActive: true } })) ??
    (await prisma.organization.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }))
  );
}

export async function getOrganizationById(id: string) {
  return prisma.organization.findUnique({ where: { id } });
}

/** Future: scope Prisma queries with organizationId from session. */
export type TenantScope = {
  organizationId: string | null;
};

export async function resolveTenantScope(userOrganizationId?: string | null): Promise<TenantScope> {
  if (userOrganizationId) return { organizationId: userOrganizationId };
  const org = await getDefaultOrganization();
  return { organizationId: org?.id ?? null };
}
