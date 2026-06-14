"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export function DocumentSearchBar({ placeholder = "Search documents…" }: { placeholder?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  return (
    <form
      className="relative max-w-md flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (q.trim()) params.set("q", q.trim());
        else params.delete("q");
        router.push(`?${params.toString()}`);
      }}
    >
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </form>
  );
}
