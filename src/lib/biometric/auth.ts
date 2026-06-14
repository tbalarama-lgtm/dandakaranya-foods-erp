import { prisma } from "@/lib/db";
import { biometricConfig } from "./config";

export async function authenticateBiometricRequest(request: Request): Promise<
  | { ok: true; deviceId: string }
  | { ok: false; status: number; message: string }
> {
  const deviceKey =
    request.headers.get("x-device-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!deviceKey) {
    return { ok: false, status: 401, message: "Missing X-Device-Key or Bearer token" };
  }

  const device = await prisma.biometricDevice.findFirst({
    where: { apiKey: deviceKey, enabled: true },
  });

  if (!device) {
    if (biometricConfig.webhookSecret && deviceKey === biometricConfig.webhookSecret) {
      const fallback = await prisma.biometricDevice.findFirst({ where: { enabled: true } });
      if (fallback) return { ok: true, deviceId: fallback.id };
    }
    return { ok: false, status: 403, message: "Invalid device key" };
  }

  return { ok: true, deviceId: device.id };
}
