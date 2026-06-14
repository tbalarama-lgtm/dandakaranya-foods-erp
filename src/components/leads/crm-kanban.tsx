"use client";

import { useState } from "react";
import type { LeadStage } from "@prisma/client";
import { updateLeadStage } from "@/actions/leads";
import type { CrmLeadDto } from "@/lib/crm-types";
import {
  CRM_KANBAN_STAGES,
  CRM_STAGE_COLORS,
  CRM_STAGE_LABELS,
  CRM_TERMINAL_STAGES,
  normalizeStage,
} from "@/lib/crm-types";
import { CrmLeadCard } from "@/components/leads/crm-lead-card";
import { formatInr } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CrmKanban({ initialLeads }: { initialLeads: CrmLeadDto[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<LeadStage | null>(null);

  const allStages = [...CRM_KANBAN_STAGES, ...CRM_TERMINAL_STAGES.filter((s) => s !== "DORMANT")];

  const onDrop = async (stage: LeadStage) => {
    if (!dragId) return;
    const lead = leads.find((l) => l.id === dragId);
    if (!lead || normalizeStage(lead.stage) === normalizeStage(stage)) {
      setDragId(null);
      setOverStage(null);
      return;
    }

    setLeads((prev) =>
      prev.map((l) => (l.id === dragId ? { ...l, stage } : l)),
    );

    try {
      await updateLeadStage(dragId, stage);
      toast.success(`Moved to ${CRM_STAGE_LABELS[stage]}`);
    } catch {
      setLeads(initialLeads);
      toast.error("Could not update stage");
    }

    setDragId(null);
    setOverStage(null);
  };

  return (
    <div className="-mx-1 overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none">
      <div className="flex min-w-max gap-3 px-1">
        {allStages.map((stage) => {
          const stageLeads = leads.filter((l) => normalizeStage(l.stage) === normalizeStage(stage));
          const value = stageLeads.reduce((s, l) => s + (l.value ?? 0), 0);
          const weighted = stageLeads.reduce((s, l) => s + l.weightedValue, 0);
          const isOver = overStage === stage;
          const dragging = dragId != null;

          return (
            <div
              key={stage}
              className={cn(
                "w-[min(100vw-2rem,300px)] shrink-0 snap-center rounded-xl border border-border/50 bg-muted/20 transition md:w-[280px]",
                isOver && "border-[#B68D40]/60 bg-[#B68D40]/8 shadow-lg ring-2 ring-[#B68D40]/20",
                dragging && !isOver && "opacity-90",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage);
              }}
              onDragLeave={() => setOverStage(null)}
              onDrop={(e) => {
                e.preventDefault();
                void onDrop(stage);
              }}
            >
              <div
                className="rounded-t-xl border-b border-border/40 px-3 py-2.5"
                style={{ borderTop: `3px solid ${CRM_STAGE_COLORS[stage]}` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider">{CRM_STAGE_LABELS[stage]}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {stageLeads.length} deal{stageLeads.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span
                    className="flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: CRM_STAGE_COLORS[stage] }}
                  >
                    {stageLeads.length}
                  </span>
                </div>
                {(value > 0 || weighted > 0) && (
                  <div className="mt-1.5 flex flex-wrap gap-x-2 text-[10px]">
                    {value > 0 && <span className="font-semibold text-[#B68D40]">{formatInr(value)}</span>}
                    {weighted > 0 && weighted !== value && (
                      <span className="text-muted-foreground">Wt. {formatInr(weighted)}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="max-h-[calc(100vh-320px)] min-h-[120px] space-y-2 overflow-y-auto p-2">
                {stageLeads.length === 0 ? (
                  <p
                    className={cn(
                      "rounded-lg border border-dashed py-8 text-center text-xs transition",
                      isOver ? "border-[#B68D40]/50 bg-[#B68D40]/5 text-[#967235]" : "border-border/40 text-muted-foreground",
                    )}
                  >
                    Drop leads here
                  </p>
                ) : (
                  stageLeads.map((lead) => (
                    <CrmLeadCard
                      key={lead.id}
                      lead={lead}
                      draggable
                      compact
                      onDragStart={() => setDragId(lead.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                      isDragging={dragId === lead.id}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
