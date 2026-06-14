import { apiHandler, jsonOk } from "@/lib/api/handler";
import { prisma } from "@/lib/db";

export const GET = apiHandler(
  async (_ctx, request) => {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get("deviceId");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

    const punches = await prisma.biometricPunch.findMany({
      where: deviceId ? { deviceId } : undefined,
      orderBy: { punchedAt: "desc" },
      take: limit,
      include: {
        device: { select: { name: true } },
        employee: { select: { name: true, employeeNo: true } },
      },
    });

    return jsonOk(punches);
  },
  { permission: "hr.view" },
);
