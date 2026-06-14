"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function ReportDateFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-4 pt-6">
        <div>
          <Label htmlFor="report-from">From</Label>
          <input
            id="report-from"
            name="from"
            type="date"
            defaultValue={from}
            className="mt-1.5 flex h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="report-to">To</Label>
          <input
            id="report-to"
            name="to"
            type="date"
            defaultValue={to}
            className="mt-1.5 flex h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>
        <Button
          type="button"
          onClick={() => {
            const fromEl = document.getElementById("report-from") as HTMLInputElement;
            const toEl = document.getElementById("report-to") as HTMLInputElement;
            const params = new URLSearchParams(searchParams.toString());
            if (fromEl?.value) params.set("from", fromEl.value);
            else params.delete("from");
            if (toEl?.value) params.set("to", toEl.value);
            else params.delete("to");
            router.push(`/reports?${params.toString()}`);
          }}
        >
          Apply filter
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/reports")}
        >
          This month
        </Button>
      </CardContent>
    </Card>
  );
}
