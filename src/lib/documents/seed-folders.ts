import type { FolderSeed } from "./constants";
import { prisma } from "@/lib/db";

export async function seedFolders(tree: FolderSeed[], parentId?: string, parentPath = "") {
  for (const [index, node] of tree.entries()) {
    const path = parentPath ? `${parentPath}/${node.slug}` : node.slug;
    const folder = await prisma.documentFolder.upsert({
      where: { slug: node.slug },
      update: {
        name: node.name,
        department: node.department,
        path,
        parentId: parentId ?? null,
        sortOrder: index,
      },
      create: {
        slug: node.slug,
        name: node.name,
        department: node.department,
        path,
        parentId: parentId ?? null,
        sortOrder: index,
      },
    });

    if (node.children?.length) {
      await seedFolders(node.children, folder.id, path);
    }
  }
}
