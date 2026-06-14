import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateBiometricRequest } from "@/lib/biometric/auth";
import { normalizeWebhookPayload } from "@/lib/biometric/providers/webhook";
import { ingestPunches, processUnprocessedPunches } from "@/lib/biometric/sync";
import type { WebhookPayload } from "@/lib/biometric/types";

/**
 * Public endpoint for biometric devices / ZK agents (no session cookie).
 * Auth: header `X-Device-Key: <device.apiKey>` from HR → Biometric → Devices
 */
export async function POST(request: Request) {
  const auth = await authenticateBiometricRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as WebhookPayload;
    const punches = normalizeWebhookPayload(body);

    if (!punches.length) {
      return NextResponse.json({ error: "No punches in payload" }, { status: 400 });
    }

    const received = await ingestPunches(auth.deviceId, punches, body);
    const result = await processUnprocessedPunches(auth.deviceId);

    await prisma.biometricDevice.update({
      where: { id: auth.deviceId },
      data: { status: "ONLINE", lastSyncAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: { received, ...result },
    });
  } catch (e) {
    console.error("[biometric/webhook]", e);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
