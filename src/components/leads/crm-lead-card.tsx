"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Calendar,
  Clock,
  Globe,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Phone,
  TrendingUp,
  User,
} from "lucide-react";
import type { CrmLeadDto } from "@/lib/crm-types";
import {
  CRM_PRIORITY_LABELS,
  CRM_PRIORITY_STYLES,
  CRM_SOURCE_LABELS,
  CRM_STAGE_LABELS,
  normalizeStage,
} from "@/lib/crm-types";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { predictLeadConversion } from "@/lib/crm-insights";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function probabilityColor(pct: number) {
  if (pct >= 60) return "text-emerald-600 bg-emerald-500/12";
  if (pct >= 35) return "text-amber-600 bg-amber-500/12";
  return "text-slate-600 bg-slate-500/12";
}

export function CrmLeadCard({
  lead,
  draggable = false,
  onDragStart,
  onDragEnd,
  compact = false,
  isDragging = false,
}: {
  lead: CrmLeadDto;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  compact?: boolean;
  isDragging?: boolean;
}) {
  const stage = normalizeStage(lead.stage);
  const aiScore = predictLeadConversion(lead);
  const followUpOverdue =
    lead.followUpAt && new Date(lead.followUpAt) < new Date() && !["WON", "CONVERTED", "LOST"].includes(lead.stage);

  return (
    <motion.div
      layout
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "erp-kpi-card group border border-border/60 p-3 transition",
        draggable && "cursor-grab active:cursor-grabbing",
        lead.isStale && "border-amber-500/40",
        draggable && "hover:border-[#B68D40]/40 hover:shadow-md",
        isDragging && "opacity-50 ring-2 ring-[#B68D40]/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Avatar className="h-8 w-8 shrink-0 border border-[#B68D40]/20">
            <AvatarFallback className="bg-gradient-to-br from-[#1E3A5F] to-[#2A4A6F] text-[10px] font-semibold text-white">
              {initials(lead.company)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Link href={`/leads/${lead.id}`} className="truncate font-semibold hover:text-[#B68D40]">
              {lead.company}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{lead.contactName}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" strokeWidth={ICON_STROKE} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/leads/${lead.id}`}>View details</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold", CRM_PRIORITY_STYLES[lead.priority])}>
          {CRM_PRIORITY_LABELS[lead.priority]}
        </span>
        <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold", probabilityColor(aiScore))}>
          <TrendingUp className="h-3 w-3" />
          {aiScore}%
        </span>
        {lead.leadSource && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {CRM_SOURCE_LABELS[lead.leadSource]}
          </span>
        )}
        {lead.isStale && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
            <AlertCircle className="h-3 w-3" />
            Stale
          </span>
        )}
      </div>

      {!compact && lead.products && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{lead.products}</p>
      )}

      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deal value</p>
          <p className="font-semibold text-[#B68D40]">
            {lead.value != null && lead.value > 0 ? formatInr(lead.value) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Probability</p>
          <p className="font-semibold">{lead.probability}%</p>
        </div>
      </div>

      {lead.followUpAt && (
        <div
          className={cn(
            "mt-2 flex items-center gap-1 text-[10px]",
            followUpOverdue ? "font-semibold text-red-600" : "text-muted-foreground",
          )}
        >
          <Calendar className="h-3 w-3" />
          Follow-up {formatDate(new Date(lead.followUpAt))}
        </div>
      )}

      {lead.lastActivity && (
        <div className="mt-1.5 flex items-start gap-1 text-[10px] text-muted-foreground">
          <Clock className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="line-clamp-1">
            {lead.lastActivity.channel} · {formatDate(new Date(lead.lastActivity.at))}
          </span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {lead.commCount > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3" />
              {lead.commCount}
            </span>
          )}
          {lead.pendingTasks > 0 && (
            <span className="inline-flex items-center gap-0.5 text-amber-600">
              <Calendar className="h-3 w-3" />
              {lead.pendingTasks}
            </span>
          )}
          {lead.country && (
            <span className="inline-flex items-center gap-0.5">
              <Globe className="h-3 w-3" />
              {lead.country}
            </span>
          )}
          {lead.ageDays > 0 && !compact && (
            <span>{lead.ageDays}d idle</span>
          )}
        </div>
        {lead.assignee ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium">
            <User className="h-3 w-3" />
            {lead.assignee.name.split(" ")[0]}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">Unassigned</span>
        )}
      </div>

      {!compact && (
        <p className="mt-1 text-[10px] text-muted-foreground">{CRM_STAGE_LABELS[stage]}</p>
      )}

      <div className="mt-2 flex gap-1 opacity-0 transition group-hover:opacity-100 max-md:opacity-100">
        <Button type="button" size="sm" variant="ghost" className="h-7 flex-1 px-1" asChild>
          <a href={`tel:${lead.phone}`}>
            <Phone className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
          </a>
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 flex-1 px-1" asChild>
          <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
            <MessageCircle className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
          </a>
        </Button>
        {lead.email && (
          <Button type="button" size="sm" variant="ghost" className="h-7 flex-1 px-1" asChild>
            <a href={`mailto:${lead.email}`}>
              <Mail className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
            </a>
          </Button>
        )}
      </div>
    </motion.div>
  );
}
