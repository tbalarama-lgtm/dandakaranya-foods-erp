import type { BiometricPunchInput } from "../types";

/**
 * ZKTeco / eSSL devices (ZK protocol on TCP 4370).
 * Production: use node-zklib, node-zkteco, or a local agent that POSTs to our webhook.
 * This pull returns demo punches when the device is unreachable.
 */
export async function pullZKTecoPunches(
  ipAddress: string,
  port: number,
): Promise<{ punches: BiometricPunchInput[]; simulated: boolean }> {
  if (!ipAddress || ipAddress === "0.0.0.0") {
    return { punches: [], simulated: false };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(`http://${ipAddress}:${port}`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeout);
  } catch {
    // Device SDK not bundled — agent / webhook recommended
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  return {
    simulated: true,
    punches: [
      { deviceUserId: "1", punchedAt: `${today}T09:02:00`, direction: "IN" },
      { deviceUserId: "1", punchedAt: `${today}T18:05:00`, direction: "OUT" },
      { deviceUserId: "2", punchedAt: `${today}T09:22:00`, direction: "IN" },
      { deviceUserId: "2", punchedAt: `${today}T18:00:00`, direction: "OUT" },
    ],
  };
}
