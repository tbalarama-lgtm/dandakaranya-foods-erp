import { apiHandler, jsonOk } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import type { DeviceConnectionInput } from "@/lib/biometric/types";

export const GET = apiHandler(
  async () => {
    const devices = await prisma.biometricDevice.findMany({
      orderBy: { name: "asc" },
      include: {
        branch: { select: { name: true } },
        _count: { select: { punches: true } },
      },
    });
    return jsonOk(devices);
  },
  { permission: "hr.view" },
);

export const POST = apiHandler(
  async (_ctx, request) => {
    const body = (await request.json()) as DeviceConnectionInput;
    const device = await prisma.biometricDevice.create({
      data: {
        name: body.name,
        provider: body.provider,
        ipAddress: body.ipAddress,
        port: body.port ?? 4370,
        serialNo: body.serialNo,
        branchId: body.branchId,
        status: "OFFLINE",
      },
    });
    return jsonOk(device, 201);
  },
  { permission: "hr.manage" },
);
