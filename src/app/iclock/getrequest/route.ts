import { NextResponse } from "next/server";
import { findDeviceBySerial } from "@/lib/biometric/adms-handler";
import { prisma } from "@/lib/db";

/**
 * ZK / Secureye ADMS heartbeat — device polls this URL.
 * Configure on S-AIF600: Communication → Cloud Server → Server URL host, port 3001
 */
export async function GET(request: Request) {
  const sn = new URL(request.url).searchParams.get("SN") ?? "";
  if (sn) {
    const device = await findDeviceBySerial(sn);
    if (device) {
      await prisma.biometricDevice.update({
        where: { id: device.id },
        data: { status: "ONLINE", lastSyncAt: new Date() },
      });
    }
  }
  return new NextResponse("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
