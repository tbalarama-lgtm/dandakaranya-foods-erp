"use server";

import { revalidatePath } from "next/cache";
import { ActivityAction, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/session";

const inviteSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole),
});

export async function inviteUser(data: z.infer<typeof inviteSchema>) {
  const admin = await requirePermission("users.manage");
  const parsed = inviteSchema.parse(data);

  const existing = await prisma.user.findUnique({ where: { email: parsed.email.toLowerCase() } });
  if (existing) throw new Error("A user with this email already exists");

  const passwordHash = await bcrypt.hash(parsed.password, 12);
  const user = await prisma.user.create({
    data: {
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      passwordHash,
      role: parsed.role,
      active: true,
    },
  });

  await logActivity({
    userId: admin.id,
    userName: admin.name,
    action: ActivityAction.CREATE,
    entityType: "User",
    entityId: user.id,
    message: `Invited user ${user.email} as ${user.role}`,
  });

  revalidatePath("/users");
  return user;
}

export async function updateUserRole(userId: string, role: UserRole) {
  const admin = await requirePermission("users.manage");
  if (admin.id === userId && role !== UserRole.ADMIN) {
    throw new Error("You cannot remove your own admin role");
  }

  const user = await prisma.user.update({ where: { id: userId }, data: { role } });

  await logActivity({
    userId: admin.id,
    userName: admin.name,
    action: ActivityAction.UPDATE,
    entityType: "User",
    entityId: userId,
    message: `Changed role for ${user.email} to ${role}`,
  });

  revalidatePath("/users");
}

export async function toggleUserActive(userId: string, active: boolean) {
  const admin = await requirePermission("users.manage");
  if (admin.id === userId && !active) throw new Error("You cannot disable your own account");

  const user = await prisma.user.update({ where: { id: userId }, data: { active } });

  await logActivity({
    userId: admin.id,
    userName: admin.name,
    action: ActivityAction.UPDATE,
    entityType: "User",
    entityId: userId,
    message: `${active ? "Activated" : "Disabled"} user ${user.email}`,
  });

  revalidatePath("/users");
}
