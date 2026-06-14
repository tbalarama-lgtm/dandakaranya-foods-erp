import { apiHandler, jsonOk } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { syncBiometricDevice } from "@/lib/biometric/device-sync";

export const POST = apiHandler(
  async (_ctx, request) => {
    const body = await request.json().catch(() => ({}));
    const deviceId = body.deviceId as string | undefined;

    const devices = deviceId
      ? await prisma.biometricDevice.findMany({ where: { id: deviceId, enabled: true } })
      : await prisma.biometricDevice.findMany({ where: { enabled: true } });

    const results = [];
    for (const device of devices) {
      results.push(await syncBiometricDevice(device));
    }

    return jsonOk({ results });
  },
  { permission: "hr.manage" },
);
