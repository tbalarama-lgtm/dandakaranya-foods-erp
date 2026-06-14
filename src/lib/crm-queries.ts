import type { LeadPriority, LeadSource, LeadStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeCrmLead } from "@/lib/crm-metrics";
import type { CrmPipelineView } from "@/lib/crm-types";

export type CrmLeadFilters = {
  q?: string;
  stage?: LeadStage;
  priority?: LeadPriority;
  source?: LeadSource;
  assignee?: string;
  pipeline?: CrmPipelineView;
};

export async function getCrmLeads(filters?: CrmLeadFilters) {
  const where: Prisma.LeadWhereInput = {};

  if (filters?.stage) where.stage = filters.stage;
  if (filters?.priority) where.priority = filters.priority;
  if (filters?.source) where.leadSource = filters.source;
  if (filters?.assignee) where.assigneeId = filters.assignee;

  if (filters?.pipeline === "export") {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { country: { not: null }, NOT: { country: { equals: "India", mode: "insensitive" } } },
    ];
  } else if (filters?.pipeline === "distributor") {
    where.OR = [
      { leadSource: "DISTRIBUTOR" },
      { distributorName: { not: null } },
    ];
  }

  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    const searchOr: Prisma.LeadWhereInput[] = [
      { company: { contains: q, mode: "insensitive" } },
      { contactName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { products: { contains: q, mode: "insensitive" } },
      { country: { contains: q, mode: "insensitive" } },
      { distributorName: { contains: q, mode: "insensitive" } },
      { moq: { contains: q, mode: "insensitive" } },
      { certifications: { contains: q, mode: "insensitive" } },
    ];
    if (where.OR) {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { OR: where.OR }, { OR: searchOr }];
      delete where.OR;
    } else {
      where.OR = searchOr;
    }
  }

  const leads = await prisma.lead.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true } },
      _count: { select: { communications: true, tasks: true } },
      tasks: { where: { status: "PENDING" }, select: { status: true } },
      communications: {
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { channel: true, sentAt: true, message: true },
      },
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });

  return leads.map(serializeCrmLead);
}

export async function getCrmAssignees() {
  return prisma.user.findMany({
    where: { role: { in: ["SALES_EXECUTIVE", "MANAGER", "ADMIN"] }, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getLeadConversionChain(leadId: string) {
  const [quotations, orders] = await Promise.all([
    prisma.quotation.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        total: true,
        convertedOrderId: true,
      },
    }),
    prisma.salesOrder.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        invoice: { select: { id: true, invoiceNumber: true, status: true, paymentStatus: true } },
      },
    }),
  ]);

  return { quotations, orders };
}
