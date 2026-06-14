import { auth } from "@/auth";
import type { UserRole } from "@prisma/client";
import { can, type Permission } from "./rbac";

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "User",
    email: session.user.email ?? "",
    role: session.user.role as UserRole,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user.role, permission)) throw new Error("Forbidden");
  return user;
}
