"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { ActivityAction } from "@prisma/client";

export function ActivityFilters() {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const q = String(fd.get("q") ?? "");
        const action = String(fd.get("action") ?? "");
        const next = new URLSearchParams();
        if (q) next.set("q", q);
        if (action) next.set("action", action);
        router.push(`/activity?${next.toString()}`);
      }}
    >
      <Input name="q" placeholder="Search logs…" defaultValue={params.get("q") ?? ""} className="max-w-xs" />
      <select
        name="action"
        defaultValue={params.get("action") ?? ""}
        className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="">All actions</option>
        {Object.values(ActivityAction).map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-xl bg-gold-500 px-4 py-2 text-sm font-semibold text-black">
        Filter
      </button>
    </form>
  );
}
