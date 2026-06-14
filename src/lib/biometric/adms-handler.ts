import { prisma } from "@/lib/db";
import { ingestPunches, processUnprocessedPunches } from "./sync";
import { parseAdmsAttlogBody } from "./providers/secureye";

export async function findDeviceBySerial(sn: string) {
  const device = await prisma.biometricDevice.findFirst({
    where: {
      enabled: true,
      OR: [{ serialNo: sn }, { serialNo: { contains: sn } }],
    },
  });
  if (device) return device;

  return prisma.biometricDevice.findFirst({
    where: { enabled: true, provider: "SECUREYE_S_AIF600" },
  });
}

export async function handleAdmsAttlog(sn: string, body: string) {
  const device = await findDeviceBySerial(sn);
  if (!device) {
    return { ok: false as const, response: "UNKNOWN DEVICE", status: 404 };
  }

  const punches = parseAdmsAttlogBody(body);
  if (!punches.length) {
    return { ok: true as const, response: "OK", status: 200, received: 0 };
  }

  const received = await ingestPunches(device.id, punches, { sn, raw: body.slice(0, 2000) });
  await processUnprocessedPunches(device.id);

  await prisma.biometricDevice.update({
    where: { id: device.id },
    data: { status: "ONLINE", lastSyncAt: new Date(), lastError: null },
  });

  return { ok: true as const, response: "OK", status: 200, received, deviceId: device.id };
}
