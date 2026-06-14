import { ActivityAction, Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "./db";

type LogParams = {
  userId?: string | null;
  userName?: string | null;
  action: ActivityAction;
  entityType: string;
  entityId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
};

export async function logActivity(params: LogParams) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const userAgent = h.get("user-agent") ?? null;

  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId ?? undefined,
        userName: params.userName ?? undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? undefined,
        message: params.message,
        metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: ip,
        userAgent,
      },
    });
  } catch (e) {
    console.error("Activity log failed:", e);
  }
}
