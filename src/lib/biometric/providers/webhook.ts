import type { WebhookPayload, BiometricPunchInput } from "../types";
import { normalizeSecureyeWebhookPayload } from "./secureye";

export function normalizeWebhookPayload(body: WebhookPayload): BiometricPunchInput[] {
  const secureye = normalizeSecureyeWebhookPayload(body as Record<string, unknown>);
  if (secureye.length) return secureye;
  if (body.punches?.length) {
    return body.punches.map((p) => ({
      deviceUserId: String(p.deviceUserId),
      punchedAt: p.punchedAt,
      direction: p.direction,
    }));
  }
  if (body.deviceUserId && body.punchedAt) {
    return [
      {
        deviceUserId: String(body.deviceUserId),
        punchedAt: body.punchedAt,
        direction: body.direction,
      },
    ];
  }
  return [];
}
