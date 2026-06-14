import type { BiometricPunchInput } from "../types";
import { pullZKTecoPunches } from "./zkteco";

/** Secureye S-AIF600 — face + fingerprint, ONtime SDK, TCP/IP & Wi-Fi, push-capable */
export const SECUREYE_S_AIF600 = {
  model: "S-AIF600",
  brand: "Secureye",
  defaultPort: 4370,
  admsPath: "/iclock",
  maxUsers: 1500,
  maxLogs: 150_000,
  authModes: ["face", "fingerprint", "card", "password"] as const,
};

/**
 * ZK / ADMS attendance log line (tab-separated):
 * PIN, DateTime, Status, Verify, InOutMode, WorkCode
 * InOutMode: 0 = check-in, 1 = check-out (common on ZK OEM firmware)
 */
export function parseAdmsAttlogBody(body: string): BiometricPunchInput[] {
  const punches: BiometricPunchInput[] = [];
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (line.startsWith("USER") || line.startsWith("FP") || line.includes("=")) continue;
    const parts = line.split("\t");
    if (parts.length < 2) continue;

    const deviceUserId = parts[0]?.trim();
    const dateTimeStr = parts[1]?.trim();
    if (!deviceUserId || !dateTimeStr) continue;

    const inOut = parts[4] !== undefined ? Number(parts[4]) : undefined;
    let direction: "IN" | "OUT" | undefined;
    if (inOut === 0) direction = "IN";
    else if (inOut === 1) direction = "OUT";

    const punchedAt = normalizeSecureyeDateTime(dateTimeStr);
    if (!punchedAt) continue;

    punches.push({ deviceUserId, punchedAt, direction });
  }

  return punches;
}

function normalizeSecureyeDateTime(raw: string): string | null {
  const normalized = raw.replace(/\//g, "-");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** ONtime export / middleware JSON shapes */
export function normalizeSecureyeWebhookPayload(body: Record<string, unknown>): BiometricPunchInput[] {
  if (Array.isArray(body.punches)) {
    return (body.punches as BiometricPunchInput[]).map((p) => ({
      deviceUserId: String(p.deviceUserId),
      punchedAt: p.punchedAt,
      direction: p.direction,
    }));
  }

  if (Array.isArray(body.attendance) || Array.isArray(body.logs)) {
    const rows = (body.attendance ?? body.logs) as Record<string, unknown>[];
    return rows.map((row) => ({
      deviceUserId: String(row.userId ?? row.pin ?? row.employeeCode ?? row.PIN ?? ""),
      punchedAt: String(row.punchTime ?? row.datetime ?? row.time ?? row.DateTime ?? ""),
      direction:
        row.inOut === 1 || row.direction === "OUT" || row.type === "out"
          ? ("OUT" as const)
          : row.inOut === 0 || row.direction === "IN" || row.type === "in"
            ? ("IN" as const)
            : undefined,
    })).filter((p) => p.deviceUserId && p.punchedAt);
  }

  if (body.deviceUserId && body.punchedAt) {
    return [
      {
        deviceUserId: String(body.deviceUserId),
        punchedAt: String(body.punchedAt),
        direction: body.direction as "IN" | "OUT" | undefined,
      },
    ];
  }

  return [];
}

/**
 * Pull via ZK TCP (many Secureye face terminals use ZK-compatible firmware on port 4370).
 * Otherwise use ADMS push to /iclock/cdata or ONtime → webhook.
 */
export async function pullSecureyePunches(
  ipAddress: string,
  port: number,
): Promise<{ punches: BiometricPunchInput[]; simulated: boolean; hint?: string }> {
  const zk = await pullZKTecoPunches(ipAddress, port);
  return {
    ...zk,
    hint: zk.simulated
      ? "Configure Cloud Server on device: Server IP = ERP host, Port = 3001, enable ADMS/Push. Or use ONtime agent → webhook."
      : undefined,
  };
}
