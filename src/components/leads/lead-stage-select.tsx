"use client";

import { LeadStage } from "@prisma/client";
import { updateLeadStage } from "@/actions/leads";
import { CRM_STAGE_LABELS } from "@/lib/crm-types";

export function LeadStageSelect({ id, stage }: { id: string; stage: LeadStage }) {
  return (
    <select
      defaultValue={stage}
      className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
      onChange={async (e) => {
        await updateLeadStage(id, e.target.value as LeadStage);
      }}
    >
      {Object.values(LeadStage).map((s) => (
        <option key={s} value={s}>
          {CRM_STAGE_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
