"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addLeadComment } from "@/actions/leads";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export function CrmComments({
  leadId,
  notes,
}: {
  leadId: string;
  notes: { id: string; content: string; createdAt: Date | string; user?: { name: string } | null }[];
}) {
  const router = useRouter();
  const [content, setContent] = useState("");

  return (
    <div className="erp-kpi-card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquarePlus className="h-4 w-4 text-[#B68D40]" />
        Internal comments
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">Team collaboration — not visible to customers</p>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        placeholder="Add a note for your team…"
        className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm"
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="mt-2"
        onClick={async () => {
          if (!content.trim()) return;
          await addLeadComment(leadId, content.trim());
          setContent("");
          toast.success("Comment added");
          router.refresh();
        }}
      >
        Post comment
      </Button>

      <ul className="mt-4 space-y-3">
        {notes.length === 0 ? (
          <li className="text-xs text-muted-foreground">No internal comments yet.</li>
        ) : (
          notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                <span className="font-semibold text-foreground">{n.user?.name ?? "Team"}</span>
                <span>{formatDate(new Date(n.createdAt))}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed">{n.content}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
