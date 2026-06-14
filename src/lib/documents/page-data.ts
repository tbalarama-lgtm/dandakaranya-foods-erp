import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canAccessDocuments } from "@/lib/documents/permissions";
import { ensureDocumentFolders } from "@/lib/documents/queries";
import { getCurrentUser } from "@/lib/session";

export async function requireVaultAccess() {
  const user = await getCurrentUser();
  if (!user || !canAccessDocuments(user.role)) redirect("/");
  await ensureDocumentFolders();
  return user;
}

export async function getVaultFolders() {
  return prisma.documentFolder.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, department: true, path: true, parentId: true },
  });
}

export async function getRootFolders() {
  return prisma.documentFolder.findMany({
    where: { parentId: null },
    include: {
      children: { orderBy: { sortOrder: "asc" } },
      _count: { select: { documents: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
}
