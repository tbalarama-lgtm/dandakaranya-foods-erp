"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, Download, Fingerprint, LogIn, LogOut, Settings2 } from "lucide-react";
import type { AttendanceRecord } from "@/lib/hr/types";
import { MOCK_EMPLOYEES } from "@/lib/hr/mock-data";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { AttendanceStatusBadge } from "@/components/hr/status-badge";
import { HrExportButtons } from "@/components/hr/hr-export-buttons";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  PRESENT: "bg-emerald-500",
  ABSENT: "bg-rose-500",
  LATE: "bg-amber-500",
  LEAVE: "bg-violet-500",
  HOLIDAY: "bg-slate-400",
};

export function AttendanceClient({ records }: { records: AttendanceRecord[] }) {
  const [clockedIn, setClockedIn] = useState(false);
  const empMap = Object.fromEntries(MOCK_EMPLOYEES.map((e) => [e.id, e]));

  const calendarDays = Array.from({ length: 28 }, (_, i) => {
    const day = i + 1;
    const statuses = ["PRESENT", "PRESENT", "LATE", "ABSENT", "PRESENT", "HOLIDAY", "PRESENT"];
    return { day, status: statuses[i % statuses.length] };
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard>
          <GlassCardBody className="flex items-center gap-3">
            <Button size="lg" onClick={() => { setClockedIn(true); toast.success("Clocked in"); }}>
              <LogIn className="mr-2 h-4 w-4" />
              Clock in
            </Button>
            <Button size="lg" variant="outline" disabled={!clockedIn} onClick={() => { setClockedIn(false); toast.success("Clocked out"); }}>
              <LogOut className="mr-2 h-4 w-4" />
              Clock out
            </Button>
          </GlassCardBody>
        </GlassCard>
        <GlassCard>
          <GlassCardBody className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <Fingerprint className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Biometric devices</p>
                <p className="text-muted-foreground">Secureye S-AIF600 · ADMS · Webhook</p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/hr/attendance/biometric">
                <Settings2 className="mr-2 h-4 w-4" />
                Configure
              </Link>
            </Button>
          </GlassCardBody>
        </GlassCard>
        <GlassCard className="sm:col-span-2">
          <GlassCardBody className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-sm">Late marks auto-detected after 9:15 AM</span>
            </div>
            <HrExportButtons filename="attendance-report" />
          </GlassCardBody>
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <GlassCardHeader className="flex flex-row items-center justify-between">
            <h3 className="font-semibold">Daily attendance</h3>
            <Button variant="ghost" size="sm" onClick={() => toast.success("Report downloaded")}>
              <Download className="mr-2 h-4 w-4" />
              Report
            </Button>
          </GlassCardHeader>
          <GlassCardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2">Employee</th>
                  <th className="px-4 py-2">In</th>
                  <th className="px-4 py-2">Out</th>
                  <th className="px-4 py-2">Late</th>
                  <th className="px-4 py-2">OT (min)</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="px-4 py-2 font-medium">{empMap[r.employeeId]?.name ?? r.employeeId}</td>
                    <td className="px-4 py-2">{r.checkIn?.slice(0, 5) ?? "—"}</td>
                    <td className="px-4 py-2">{r.checkOut?.slice(0, 5) ?? "—"}</td>
                    <td className="px-4 py-2">{r.lateMinutes ? `${r.lateMinutes}m` : "—"}</td>
                    <td className="px-4 py-2">{r.overtimeMinutes || "—"}</td>
                    <td className="px-4 py-2">
                      <AttendanceStatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCardBody>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader>
            <h3 className="font-semibold">Attendance calendar</h3>
            <p className="text-xs text-muted-foreground">May 2026</p>
          </GlassCardHeader>
          <GlassCardBody>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
              {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
                <span key={d} className="font-medium text-muted-foreground">
                  {d}
                </span>
              ))}
              {calendarDays.map(({ day, status }) => (
                <div
                  key={day}
                  title={status}
                  className={`flex h-8 items-center justify-center rounded-lg text-xs text-white ${statusColors[status] ?? "bg-muted"}`}
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
              {Object.entries(statusColors).map(([s, c]) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${c}`} />
                  {s}
                </span>
              ))}
            </div>
          </GlassCardBody>
        </GlassCard>
      </div>
    </div>
  );
}
