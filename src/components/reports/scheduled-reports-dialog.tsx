"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ICON_STROKE } from "@/lib/enterprise-ui";

export type ScheduledReport = {
  id: string;
  preset: string;
  format: "pdf" | "csv" | "excel";
  frequency: "daily" | "weekly" | "monthly";
  email: string;
  branchId?: string;
  createdAt: string;
};

const STORAGE_KEY = "dandakaranya-scheduled-reports";

export function ScheduledReportsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [preset, setPreset] = useState("month");
  const [format, setFormat] = useState<ScheduledReport["format"]>("pdf");
  const [frequency, setFrequency] = useState<ScheduledReport["frequency"]>("weekly");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState<ScheduledReport[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setSaved(raw ? JSON.parse(raw) : []);
    } catch {
      setSaved([]);
    }
  }, [open]);

  const persist = (items: ScheduledReport[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    setSaved(items);
  };

  const handleSave = () => {
    if (!email.trim()) {
      toast.error("Enter a recipient email");
      return;
    }
    const entry: ScheduledReport = {
      id: crypto.randomUUID(),
      preset,
      format,
      frequency,
      email: email.trim(),
      createdAt: new Date().toISOString(),
    };
    persist([entry, ...saved]);
    toast.success("Report schedule saved — delivery runs via server cron when configured");
    onOpenChange(false);
  };

  const remove = (id: string) => {
    persist(saved.filter((s) => s.id !== id));
    toast.success("Schedule removed");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-[#B68D40]" strokeWidth={ICON_STROKE} />
            Scheduled reporting
          </DialogTitle>
          <DialogDescription>
            Configure automated BI report delivery. Schedules are stored locally and processed by
            the export API when cron is enabled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="sched-preset">Period preset</Label>
            <select
              id="sched-preset"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="quarter">Quarter</option>
              <option value="fy">Financial year</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sched-format">Format</Label>
              <select
                id="sched-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as ScheduledReport["format"])}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
              </select>
            </div>
            <div>
              <Label htmlFor="sched-freq">Frequency</Label>
              <select
                id="sched-freq"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ScheduledReport["frequency"])}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="sched-email">Recipient email</Label>
            <input
              id="sched-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="finance@dandakaranyafoods.com"
              className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
          </div>

          {saved.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active schedules
              </p>
              <ul className="mt-2 space-y-2">
                {saved.slice(0, 3).map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-xs">
                    <span>
                      {s.frequency} · {s.preset} · {s.format} → {s.email}
                    </span>
                    <button
                      type="button"
                      className="text-red-500 hover:underline"
                      onClick={() => remove(s.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="premium" onClick={handleSave}>
            Save schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
