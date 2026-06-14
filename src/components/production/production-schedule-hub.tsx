"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import { updateScheduleSlot } from "@/actions/production-workflow";
import type { GanttSlot } from "@/lib/production-types";
import { PRODUCTION_STATUS_STYLES, PRODUCTION_STATUS_LABELS } from "@/lib/production-types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const HOUR_PX = 48;
const ROW_H = 56;

export function ProductionScheduleHub({
  slots,
  machines,
  canEdit,
}: {
  slots: GanttSlot[];
  machines: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [items, setItems] = useState(slots);
  const [pending, startTransition] = useTransition();
  const dragRef = useRef<{ id: string; startX: number; origStart: number } | null>(null);

  const { rangeStart, rangeEnd, rows } = useMemo(() => {
    if (!items.length) {
      const now = Date.now();
      return { rangeStart: now, rangeEnd: now + 7 * 86400000, rows: machines.length ? machines : [{ id: "default", name: "Line 1" }] };
    }
    const starts = items.map((s) => new Date(s.scheduledStart).getTime());
    const ends = items.map((s) => new Date(s.scheduledEnd).getTime());
    const rs = Math.min(...starts) - 3600000;
    const re = Math.max(...ends) + 3600000;
    const machineRows = machines.length ? machines : [{ id: "unassigned", name: "Unassigned" }];
    return { rangeStart: rs, rangeEnd: re, rows: machineRows };
  }, [items, machines]);

  const totalHours = (rangeEnd - rangeStart) / 3600000;
  const timelineWidth = totalHours * HOUR_PX;

  const hours = useMemo(() => {
    const labels: { left: number; label: string }[] = [];
    for (let h = 0; h <= totalHours; h += 4) {
      const t = new Date(rangeStart + h * 3600000);
      labels.push({ left: h * HOUR_PX, label: t.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit" }) });
    }
    return labels;
  }, [rangeStart, totalHours]);

  const persist = useCallback(
    (slot: GanttSlot, newStart: number, newEnd: number) => {
      startTransition(async () => {
        const res = await updateScheduleSlot({
          slotId: slot.id,
          scheduledStart: new Date(newStart).toISOString(),
          scheduledEnd: new Date(newEnd).toISOString(),
          machineId: slot.machineId,
          ganttRow: slot.ganttRow,
        });
        if (res.ok) toast.success("Schedule updated");
        else toast.error(res.error);
      });
    },
    [],
  );

  function onPointerDown(e: React.PointerEvent, slot: GanttSlot) {
    if (!canEdit || pending) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: slot.id, startX: e.clientX, origStart: new Date(slot.scheduledStart).getTime() };
  }

  function onPointerMove(e: React.PointerEvent, slot: GanttSlot) {
    const drag = dragRef.current;
    if (!drag || drag.id !== slot.id) return;
    const deltaPx = e.clientX - drag.startX;
    const deltaMs = (deltaPx / HOUR_PX) * 3600000;
    const duration = new Date(slot.scheduledEnd).getTime() - new Date(slot.scheduledStart).getTime();
    const newStart = drag.origStart + deltaMs;
    const newEnd = newStart + duration;
    setItems((prev) =>
      prev.map((s) =>
        s.id === slot.id ? { ...s, scheduledStart: new Date(newStart).toISOString(), scheduledEnd: new Date(newEnd).toISOString() } : s,
      ),
    );
  }

  function onPointerUp(e: React.PointerEvent, slot: GanttSlot) {
    const drag = dragRef.current;
    if (!drag || drag.id !== slot.id) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    persist(slot, new Date(slot.scheduledStart).getTime(), new Date(slot.scheduledEnd).getTime());
  }

  return (
    <div className="space-y-4">
      <Link href="/production" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> MES control center
      </Link>
      <p className="text-sm text-muted-foreground">
        Drag batches horizontally to reschedule. Machine rows map to production lines.
        {!canEdit && " (Read-only)"}
      </p>

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <div style={{ minWidth: timelineWidth + 160 }}>
          <div className="flex border-b border-border/40 bg-muted/30">
            <div className="w-40 shrink-0 px-3 py-2 text-xs font-medium">Machine / line</div>
            <div className="relative" style={{ width: timelineWidth, height: 32 }}>
              {hours.map((h) => (
                <span key={h.left} className="absolute top-1 text-[10px] text-muted-foreground" style={{ left: h.left }}>
                  {h.label}
                </span>
              ))}
            </div>
          </div>
          {rows.map((row, rowIdx) => {
            const rowSlots = items.filter((s) => s.machineId === row.id || (!s.machineId && row.id === "unassigned"));
            return (
              <div key={row.id} className="flex border-b border-border/30" style={{ height: ROW_H }}>
                <div className="flex w-40 shrink-0 items-center px-3 text-xs font-medium">{row.name}</div>
                <div className="relative bg-[repeating-linear-gradient(90deg,transparent,transparent_47px,rgba(0,0,0,0.04)_48px)]" style={{ width: timelineWidth }}>
                  {rowSlots.map((slot) => {
                    const left = ((new Date(slot.scheduledStart).getTime() - rangeStart) / 3600000) * HOUR_PX;
                    const width = Math.max(24, ((new Date(slot.scheduledEnd).getTime() - new Date(slot.scheduledStart).getTime()) / 3600000) * HOUR_PX);
                    return (
                      <div
                        key={slot.id}
                        role="button"
                        tabIndex={0}
                        onPointerDown={(e) => onPointerDown(e, slot)}
                        onPointerMove={(e) => onPointerMove(e, slot)}
                        onPointerUp={(e) => onPointerUp(e, slot)}
                        className={cn(
                          "absolute top-2 flex h-10 cursor-grab items-center overflow-hidden rounded-lg px-2 text-[10px] font-semibold text-white shadow active:cursor-grabbing",
                          PRODUCTION_STATUS_STYLES[slot.status],
                          canEdit && "hover:ring-2 hover:ring-[#B68D40]/50",
                        )}
                        style={{ left, width }}
                        title={`${slot.batchCode} — ${slot.productName}`}
                      >
                        <span className="truncate">{slot.batchCode}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px]">
        {items.map((s) => (
          <span key={s.id} className={cn("rounded px-2 py-0.5", PRODUCTION_STATUS_STYLES[s.status])}>
            {s.batchCode} — {PRODUCTION_STATUS_LABELS[s.status]}
          </span>
        ))}
      </div>
    </div>
  );
}
