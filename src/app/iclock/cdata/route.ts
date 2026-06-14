import { NextResponse } from "next/server";
import { handleAdmsAttlog } from "@/lib/biometric/adms-handler";

/**
 * ZK / Secureye ADMS attendance push (ATTLOG).
 * Device posts tab-separated logs: PIN, DateTime, Status, Verify, InOut, WorkCode
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const sn = url.searchParams.get("SN") ?? "";
  const table = url.searchParams.get("table") ?? "ATTLOG";

  if (!sn) {
    return new NextResponse("SN required", { status: 400 });
  }

  if (table !== "ATTLOG" && table !== "OPERLOG") {
    return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  const body = await request.text();
  if (table === "OPERLOG" || !body.trim()) {
    return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  const result = await handleAdmsAttlog(sn, body);
  if (!result.ok) {
    return new NextResponse(result.response, { status: result.status });
  }

  return new NextResponse(result.response, {
    status: result.status,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function GET(request: Request) {
  return POST(request);
}
