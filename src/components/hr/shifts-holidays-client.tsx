"use client";

import type { Holiday, ShiftSchedule } from "@/lib/hr/types";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { Badge } from "@/components/ui/badge";

export function ShiftsClient({ shifts }: { shifts: ShiftSchedule[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {shifts.map((s) => (
        <GlassCard key={s.id}>
          <GlassCardBody>
            <p className="font-semibold">{s.name}</p>
            <p className="text-sm text-muted-foreground">
              {s.startTime} – {s.endTime}
            </p>
            <p className="mt-2 text-xs">{s.branchName}</p>
            <p className="mt-3 text-2xl font-semibold text-primary">{s.employees}</p>
            <p className="text-xs text-muted-foreground">Employees assigned</p>
          </GlassCardBody>
        </GlassCard>
      ))}
    </div>
  );
}

export function HolidaysClient({ holidays }: { holidays: Holiday[] }) {
  return (
    <GlassCard>
      <GlassCardHeader>
        <h3 className="font-semibold">Holiday calendar 2026</h3>
      </GlassCardHeader>
      <GlassCardBody className="space-y-2">
        {holidays.map((h) => (
          <div
            key={h.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 px-4 py-3"
          >
            <div>
              <p className="font-medium">{h.name}</p>
              <p className="text-xs text-muted-foreground">{h.date}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="muted">{h.type}</Badge>
              {h.branchName && <Badge>{h.branchName}</Badge>}
            </div>
          </div>
        ))}
      </GlassCardBody>
    </GlassCard>
  );
}
