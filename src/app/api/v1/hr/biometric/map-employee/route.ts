import { NextResponse } from "next/server";
import { apiHandler, jsonOk } from "@/lib/api/handler";
import { prisma } from "@/lib/db";

export const POST = apiHandler(
  async (_ctx, request) => {
    const { employeeId, biometricUserId } = await request.json();
    if (!employeeId || !biometricUserId) {
      return NextResponse.json(
        { error: "employeeId and biometricUserId required" },
        { status: 400 },
      );
    }

    const employee = await prisma.employee.update({
      where: { id: employeeId },
      data: { biometricUserId: String(biometricUserId) },
    });

    await prisma.biometricPunch.updateMany({
      where: { deviceUserId: String(biometricUserId), employeeId: null },
      data: { employeeId: employee.id },
    });

    return jsonOk(employee);
  },
  { permission: "hr.manage" },
);
