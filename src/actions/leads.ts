"use server";

import { revalidatePath } from "next/cache";
import {
  ActivityAction,
  CommunicationChannel,
  LeadPriority,
  LeadSource,
  LeadStage,
  LeadTaskStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/session";
import { isWonStage } from "@/lib/crm-types";

const leadSchema = z.object({
  company: z.string().min(1),
  contactName: z.string().min(1),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  stage: z.nativeEnum(LeadStage).optional(),
  priority: z.nativeEnum(LeadPriority).optional(),
  leadSource: z.nativeEnum(LeadSource).optional(),
  products: z.string().optional(),
  volume: z.string().optional(),
  value: z.coerce.number().optional(),
  country: z.string().optional(),
  moq: z.string().optional(),
  packagingPreference: z.string().optional(),
  shippingTerms: z.string().optional(),
  certifications: z.string().optional(),
  distributorName: z.string().optional(),
  productCategories: z.string().optional(),
  assigneeId: z.string().optional(),
  followUpAt: z.string().optional(),
  message: z.string().optional(),
});

function revalidateCrm() {
  revalidatePath("/leads");
  revalidatePath("/leads/pipeline");
  revalidatePath("/");
}

export async function createLead(data: z.infer<typeof leadSchema>) {
  const user = await requirePermission("leads.create");
  const parsed = leadSchema.parse(data);

  const lead = await prisma.lead.create({
    data: {
      company: parsed.company,
      contactName: parsed.contactName,
      phone: parsed.phone,
      email: parsed.email || null,
      stage: parsed.stage ?? LeadStage.NEW,
      priority: parsed.priority ?? LeadPriority.MEDIUM,
      leadSource: parsed.leadSource,
      products: parsed.products,
      volume: parsed.volume,
      value: parsed.value,
      country: parsed.country,
      moq: parsed.moq,
      packagingPreference: parsed.packagingPreference,
      shippingTerms: parsed.shippingTerms,
      certifications: parsed.certifications,
      distributorName: parsed.distributorName,
      productCategories: parsed.productCategories,
      assigneeId: parsed.assigneeId || user.id,
      followUpAt: parsed.followUpAt ? new Date(parsed.followUpAt) : null,
      notes: parsed.message
        ? { create: { content: parsed.message, userId: user.id } }
        : undefined,
    },
  });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.CREATE,
    entityType: "Lead",
    entityId: lead.id,
    message: `Created lead: ${lead.company}`,
  });

  revalidateCrm();
  return lead;
}

export async function updateLeadStage(id: string, stage: LeadStage) {
  const user = await requirePermission("leads.edit");
  await prisma.lead.update({
    where: { id },
    data: {
      stage,
      convertedAt: isWonStage(stage) ? new Date() : undefined,
    },
  });
  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.UPDATE,
    entityType: "Lead",
    entityId: id,
    message: `Lead stage → ${stage}`,
  });
  revalidateCrm();
}

export async function updateLeadPriority(id: string, priority: LeadPriority) {
  const user = await requirePermission("leads.edit");
  await prisma.lead.update({ where: { id }, data: { priority } });
  await logActivity({
    userId: user.id,
    action: ActivityAction.UPDATE,
    entityType: "Lead",
    entityId: id,
    message: `Lead priority → ${priority}`,
  });
  revalidateCrm();
}

export async function assignLead(id: string, assigneeId: string) {
  const user = await requirePermission("leads.assign");
  await prisma.lead.update({ where: { id }, data: { assigneeId: assigneeId || null } });
  await logActivity({
    userId: user.id,
    action: ActivityAction.UPDATE,
    entityType: "Lead",
    entityId: id,
    message: `Lead reassigned`,
    metadata: { assigneeId },
  });
  revalidateCrm();
}

export async function autoAssignLead(id: string) {
  const user = await requirePermission("leads.assign");
  const workloads = await prisma.lead.groupBy({
    by: ["assigneeId"],
    where: {
      assigneeId: { not: null },
      stage: { notIn: ["WON", "CONVERTED", "LOST"] },
    },
    _count: true,
  });
  const salesUsers = await prisma.user.findMany({
    where: { role: { in: ["SALES_EXECUTIVE", "MANAGER"] }, active: true },
    select: { id: true },
  });
  const loadMap = Object.fromEntries(workloads.map((w) => [w.assigneeId!, w._count]));
  let best = salesUsers[0]?.id ?? user.id;
  let min = Infinity;
  for (const u of salesUsers) {
    const c = loadMap[u.id] ?? 0;
    if (c < min) {
      min = c;
      best = u.id;
    }
  }
  await assignLead(id, best);
  return best;
}

export async function deleteLead(id: string) {
  const user = await requirePermission("leads.edit");
  const lead = await prisma.lead.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.DELETE,
    entityType: "Lead",
    entityId: id,
    message: `Deleted lead: ${lead.company}`,
  });
  revalidateCrm();
}

export async function addLeadCommunication(
  leadId: string,
  channel: CommunicationChannel,
  message: string,
) {
  const user = await requirePermission("leads.edit");
  await prisma.leadCommunication.create({
    data: { leadId, channel, message, userId: user.id },
  });
  await prisma.lead.update({
    where: { id: leadId },
    data: { lastContactAt: new Date(), updatedAt: new Date() },
  });
  await logActivity({
    userId: user.id,
    action: ActivityAction.CREATE,
    entityType: "LeadCommunication",
    entityId: leadId,
    message: `Logged ${channel} on lead`,
  });
  revalidateCrm();
  revalidatePath(`/leads/${leadId}`);
}

export async function addLeadTask(leadId: string, title: string, dueAt?: string) {
  const user = await requirePermission("leads.edit");
  await prisma.leadTask.create({
    data: {
      leadId,
      title,
      dueAt: dueAt ? new Date(dueAt) : null,
      reminderAt: dueAt ? new Date(dueAt) : null,
      assigneeId: user.id,
    },
  });
  revalidateCrm();
  revalidatePath(`/leads/${leadId}`);
}

export async function completeLeadTask(taskId: string) {
  await requirePermission("leads.edit");
  const task = await prisma.leadTask.update({
    where: { id: taskId },
    data: { status: LeadTaskStatus.COMPLETED, completedAt: new Date() },
  });
  revalidateCrm();
  revalidatePath(`/leads/${task.leadId}`);
}

export async function createLeadQuotation(
  leadId: string,
  lines: { productId: string; quantity: number; unitPrice?: number }[],
  notes?: string,
) {
  const { createQuotation } = await import("@/actions/quotations");
  const quote = await createQuotation({ leadId, lines, notes, validDays: 30 });
  await addLeadCommunication(
    leadId,
    CommunicationChannel.QUOTATION,
    `Quotation ${quote.quoteNumber} created — ${Number(quote.total).toLocaleString("en-IN", { style: "currency", currency: "INR" })}`,
  );
  revalidateCrm();
  return quote;
}

export async function convertQuotationToOrder(quotationId: string) {
  const { convertQuotationToSalesOrder } = await import("@/actions/quotations");
  return convertQuotationToSalesOrder(quotationId);
}

export async function addLeadSample(
  leadId: string,
  data: { productName: string; productId?: string; quantity?: string },
) {
  await requirePermission("leads.edit");
  await prisma.leadSample.create({
    data: {
      leadId,
      productName: data.productName,
      productId: data.productId,
      quantity: data.quantity,
      status: "REQUESTED",
    },
  });
  await prisma.lead.update({
    where: { id: leadId },
    data: { stage: LeadStage.SAMPLE_SENT },
  });
  revalidateCrm();
}

export async function sendLeadWhatsApp(leadId: string, message: string) {
  const user = await requirePermission("leads.edit");
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const { sendWhatsAppToLead } = await import("@/lib/crm-integrations");
  const result = await sendWhatsAppToLead(lead.phone, message);

  await prisma.leadCommunication.create({
    data: {
      leadId,
      channel: "WHATSAPP",
      message: `[${result.mode}] ${message}`,
      userId: user.id,
    },
  });
  await prisma.lead.update({
    where: { id: leadId },
    data: { lastContactAt: new Date() },
  });

  revalidateCrm();
  revalidatePath(`/leads/${leadId}`);
  return result;
}

export async function sendLeadEmail(leadId: string, subject: string, body: string) {
  const user = await requirePermission("leads.edit");
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (!lead.email) throw new Error("Lead has no email address");

  const { sendEmailToLead } = await import("@/lib/crm-integrations");
  const result = await sendEmailToLead(lead.email, subject, body);

  await prisma.leadCommunication.create({
    data: {
      leadId,
      channel: "EMAIL",
      message: `Subject: ${subject}\n\n${body}`,
      userId: user.id,
    },
  });
  await prisma.lead.update({
    where: { id: leadId },
    data: { lastContactAt: new Date() },
  });

  revalidateCrm();
  revalidatePath(`/leads/${leadId}`);
  return result;
}

export async function updateLeadTastingFeedback(leadId: string, feedback: string) {
  await requirePermission("leads.edit");
  await prisma.lead.update({ where: { id: leadId }, data: { tastingFeedback: feedback } });
  revalidatePath(`/leads/${leadId}`);
}

export async function syncCrmAutomationAction() {
  await requirePermission("leads.view");
  const { syncCrmAutomation } = await import("@/lib/crm-automation");
  return syncCrmAutomation();
}

export async function addLeadComment(leadId: string, content: string) {
  const user = await requirePermission("leads.edit");
  if (!content.trim()) throw new Error("Comment cannot be empty");

  await prisma.leadNote.create({
    data: { leadId, userId: user.id, content: content.trim() },
  });

  await logActivity({
    userId: user.id,
    action: ActivityAction.CREATE,
    entityType: "LeadNote",
    entityId: leadId,
    message: "Added internal comment on lead",
  });

  revalidateCrm();
  revalidatePath(`/leads/${leadId}`);
}
