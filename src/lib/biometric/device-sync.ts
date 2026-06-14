import type { BiometricDevice } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ingestPunches, processUnprocessedPunches } from "./sync";
import { pullZKTecoPunches } from "./providers/zkteco";
import { pullSecureyePunches } from "./providers/secureye";
import type { SyncResult } from "./types";

export async function syncBiometricDevice(device: BiometricDevice): Promise<SyncResult> {
  const errors: string[] = [];
  let punchesReceived = 0;

  await prisma.biometricDevice.update({
    where: { id: device.id },
    data: { status: "SYNCING", lastError: null },
  });

  try {
    let punches: { deviceUserId: string; punchedAt: string | Date; direction?: "IN" | "OUT" }[] = [];

    if (device.provider === "SECUREYE_S_AIF600") {
      const ip = device.ipAddress ?? "";
      const { punches: pulled, simulated, hint } = await pullSecureyePunches(ip, device.port);
      punches = pulled;
      if (hint) errors.push(hint);
      if (simulated && pulled.length) {
        errors.push("S-AIF600: enable ADMS Cloud Server push to /iclock/cdata or use ONtime → webhook.");
      }
    } else if (device.provider === "ZKTECO" || device.provider === "ESSL" || device.provider === "REALTIME") {
      const ip = device.ipAddress ?? "";
      const { punches: pulled, simulated } = await pullZKTecoPunches(ip, device.port);
      punches = pulled;
      if (simulated && pulled.length) {
        errors.push("Device unreachable — applied demo punches. Use webhook or ZK agent for live data.");
      }
    }

    if (punches.length) {
      punchesReceived = await ingestPunches(device.id, punches, { source: device.provider });
    }

    const { processed, attendanceUpdated, errors: procErrors } = await processUnprocessedPunches(device.id);
    errors.push(...procErrors);

    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: {
        status: "ONLINE",
        lastSyncAt: new Date(),
        lastError: errors.length ? errors.join("; ") : null,
      },
    });

    return {
      deviceId: device.id,
      punchesReceived,
      punchesProcessed: processed,
      attendanceUpdated,
      errors,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: { status: "ERROR", lastError: msg },
    });
    return {
      deviceId: device.id,
      punchesReceived,
      punchesProcessed: 0,
      attendanceUpdated: 0,
      errors: [msg],
    };
  }
}
