"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Loader2, Package, Search, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ICON_STROKE } from "@/lib/enterprise-ui";

type Suggestion = {
  type: "invoice" | "lead" | "product";
  id: string;
  label: string;
  sub: string;
  href: string;
};

const TYPE_ICON = {
  invoice: FileText,
  lead: Users,
  product: Package,
};

export function GlobalSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q.trim())}`);
      const data = (await res.json()) as { results: Suggestion[] };
      setSuggestions(data.results ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchSuggestions(query), 280);
    return () => clearTimeout(t);
  }, [query, fetchSuggestions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/60 px-4 py-3">
          <DialogTitle className="sr-only">Enterprise search</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={ICON_STROKE} />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search invoices, products, customers, leads…"
              className="h-11 border-0 pl-10 shadow-none focus-visible:ring-0"
              autoFocus
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </DialogHeader>

        <div className="max-h-[320px] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Type at least 2 characters · <kbd className="rounded border px-1 text-xs">⌘K</kbd>
            </p>
          ) : suggestions.length === 0 && !loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results</p>
          ) : (
            <AnimatePresence>
              {suggestions.map((s, i) => {
                const Icon = TYPE_ICON[s.type];
                return (
                  <motion.button
                    key={`${s.type}-${s.id}`}
                    type="button"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => {
                      onOpenChange(false);
                      router.push(s.href);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted/60"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[#B68D40]" strokeWidth={ICON_STROKE} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.sub}</p>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {query.trim().length >= 2 && (
          <div className="border-t border-border/60 p-2">
            <button
              type="button"
              className="w-full rounded-lg py-2 text-center text-xs font-medium text-[#B68D40] hover:bg-muted/40"
              onClick={() => {
                onOpenChange(false);
                router.push(`/search?q=${encodeURIComponent(query.trim())}`);
              }}
            >
              View all results for &quot;{query.trim()}&quot;
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
