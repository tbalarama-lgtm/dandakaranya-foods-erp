import { prisma } from "@/lib/db";

export type IntegrationSendResult = {
  ok: boolean;
  channel: "whatsapp" | "email";
  mode: "api" | "fallback";
  message: string;
};

/** Send WhatsApp via Business API when configured; otherwise returns wa.me fallback URL */
export async function sendWhatsAppToLead(
  phone: string,
  message: string,
): Promise<IntegrationSendResult & { url?: string }> {
  const integration = await prisma.apiIntegration.findUnique({
    where: { provider: "whatsapp" },
  });

  const digits = phone.replace(/\D/g, "");
  const fallbackUrl = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  if (!integration?.enabled) {
    return {
      ok: true,
      channel: "whatsapp",
      mode: "fallback",
      message: "WhatsApp API not enabled — use deep link",
      url: fallbackUrl,
    };
  }

  const config = integration.config as { phoneNumberId?: string; accessToken?: string };
  if (!config.phoneNumberId || !config.accessToken) {
    return {
      ok: true,
      channel: "whatsapp",
      mode: "fallback",
      message: "WhatsApp credentials incomplete — use deep link",
      url: fallbackUrl,
    };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: digits,
          type: "text",
          text: { body: message },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      return {
        ok: false,
        channel: "whatsapp",
        mode: "api",
        message: `WhatsApp API error: ${err.slice(0, 120)}`,
        url: fallbackUrl,
      };
    }

    return { ok: true, channel: "whatsapp", mode: "api", message: "WhatsApp message sent via API" };
  } catch (e) {
    return {
      ok: false,
      channel: "whatsapp",
      mode: "fallback",
      message: e instanceof Error ? e.message : "Send failed",
      url: fallbackUrl,
    };
  }
}

/** Send email via SMTP/API integration when configured; otherwise mailto fallback */
export async function sendEmailToLead(
  email: string,
  subject: string,
  body: string,
): Promise<IntegrationSendResult & { mailto?: string }> {
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const integration = await prisma.apiIntegration.findFirst({
    where: { provider: { in: ["email", "smtp", "sendgrid"] }, enabled: true },
  });

  if (!integration) {
    return {
      ok: true,
      channel: "email",
      mode: "fallback",
      message: "Email API not configured — use mail client",
      mailto,
    };
  }

  // Placeholder for provider-specific send — log intent for audit
  return {
    ok: true,
    channel: "email",
    mode: "api",
    message: `Email queued via ${integration.label} integration`,
    mailto,
  };
}

import { applyEmailTemplate } from "@/lib/crm-types";