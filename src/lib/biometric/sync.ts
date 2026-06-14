import type { AttendanceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { lateThresholdOnDate, shiftEndOnDate } from "./config";
import type { BiometricPunchInput } from "./types";

function dateOnly(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));
}

function deriveStatus(checkIn: Date, lateMinutes: number): AttendanceStatus {
  if (lateMinutes > 0) return "LATE";
  return "PRESENT";
}

/** Map device user id → employee id */
export async function resolveEmployeeId(deviceUserId: string): Promise<string | null> {
  const emp = await prisma.employee.findFirst({
    where: { biometricUserId: deviceUserId, active: true },
  });
  return emp?.id ?? null;
}

/** Ingest raw punches into BiometricPunch table */
export async function ingestPunches(
  deviceId: string,
  punches: BiometricPunchInput[],
  raw?: unknown,
): Promise<number> {
  let count = 0;
  for (const p of punches) {
    const punchedAt = new Date(p.punchedAt);
    const employeeId = await resolveEmployeeId(p.deviceUserId);
    await prisma.biometricPunch.create({
      data: {
        deviceId,
        deviceUserId: p.deviceUserId,
        punchedAt,
        direction: p.direction === "OUT" ? "OUT" : p.direction === "IN" ? "IN" : undefined,
        employeeId,
        rawPayload: raw ? (raw as Prisma.InputJsonValue) : undefined,
      },
    });
    count++;
  }
  return count;
}

/** Process unprocessed punches → Attendance rows */
export async function processUnprocessedPunches(deviceId?: string): Promise<{
  processed: number;
  attendanceUpdated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const where = { processed: false, ...(deviceId ? { deviceId } : {}) };

  const punches = await prisma.biometricPunch.findMany({
    where,
    orderBy: { punchedAt: "asc" },
    take: 500,
  });

  const byKey = new Map<string, typeof punches>();
  for (const p of punches) {
    const empId = p.employeeId ?? (await resolveEmployeeId(p.deviceUserId));
    if (!empId) {
      errors.push(`Unmapped device user: ${p.deviceUserId}`);
      continue;
    }
    const day = dateOnly(p.punchedAt).toISOString();
    const key = `${empId}:${day}`;
    const list = byKey.get(key) ?? [];
    list.push({ ...p, employeeId: empId });
    byKey.set(key, list);
  }

  let attendanceUpdated = 0;
  const processedIds: string[] = [];

  for (const [, dayPunches] of byKey) {
    const employeeId = dayPunches[0].employeeId!;
    const day = dateOnly(dayPunches[0].punchedAt);
    const ins = dayPunches.filter((p) => p.direction === "IN" || !p.direction);
    const outs = dayPunches.filter((p) => p.direction === "OUT");
    const checkIn = ins[0]?.punchedAt ?? dayPunches[0].punchedAt;
    const checkOut = outs.length ? outs[outs.length - 1].punchedAt : dayPunches[dayPunches.length - 1].punchedAt;

    const lateMinutes =
      checkIn > lateThresholdOnDate(day) ? minutesBetween(lateThresholdOnDate(day), checkIn) : 0;
    const overtimeMinutes =
      checkOut > shiftEndOnDate(day) ? minutesBetween(shiftEndOnDate(day), checkOut) : 0;
    const status = deriveStatus(checkIn, lateMinutes);

    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: day } },
      create: {
        employeeId,
        date: day,
        status,
        checkIn,
        checkOut: checkOut > checkIn ? checkOut : undefined,
        source: "BIOMETRIC",
        lateMinutes,
        overtimeMinutes,
        deviceId: dayPunches[0].deviceId,
      },
      update: {
        status,
        checkIn,
        checkOut: checkOut > checkIn ? checkOut : undefined,
        source: "BIOMETRIC",
        lateMinutes,
        overtimeMinutes,
        deviceId: dayPunches[0].deviceId,
      },
    });
    attendanceUpdated++;
    processedIds.push(...dayPunches.map((p) => p.id));
  }

  if (processedIds.length) {
    await prisma.biometricPunch.updateMany({
      where: { id: { in: processedIds } },
      data: { processed: true },
    });
  }

  return { processed: processedIds.length, attendanceUpdated, errors };
}
