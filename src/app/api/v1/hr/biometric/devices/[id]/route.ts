import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import type { UserRole } from "@prisma/client";

async function requireHrManage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = session.user.role as UserRole;
  if (!can(role, "hr.manage")) return null;
  return session;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireHrManage();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const device = await prisma.biometricDevice.update({
    where: { id },
    data: {
      name: body.name,
      ipAddress: body.ipAddress,
      port: body.port,
      serialNo: body.serialNo,
      enabled: body.enabled,
      branchId: body.branchId,
    },
  });
  return NextResponse.json({ success: true, data: device });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireHrManage();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.biometricDevice.delete({ where: { id } });
  return NextResponse.json({ success: true, data: { deleted: true } });
}
