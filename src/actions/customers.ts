"use server";

import { revalidatePath } from "next/cache";
import {
  ActivityAction,
  CustomerAddressType,
  CustomerCommChannel,
  CustomerDocType,
  CustomerSegment,
  CustomerStatus,
  SupportTicketPriority,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/session";

const customerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  company: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  gstin: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  segment: z.nativeEnum(CustomerSegment).optional(),
  status: z.nativeEnum(CustomerStatus).optional(),
  creditLimit: z.coerce.number().optional(),
  portalEnabled: z.boolean().optional(),
  portalEmail: z.string().optional(),
  packagingPreference: z.string().optional(),
  exportRequirements: z.string().optional(),
  moq: z.string().optional(),
  distributorTerritory: z.string().optional(),
  seasonalNotes: z.string().optional(),
});

function revalidateCustomers(id?: string) {
  revalidatePath("/customers");
  if (id) revalidatePath(`/customers/${id}`);
}

export async function createCustomer(data: z.infer<typeof customerSchema>) {
  const user = await requirePermission("sales.create");
  const parsed = customerSchema.parse(data);

  const customer = await prisma.customer.create({
    data: {
      name: parsed.name,
      phone: parsed.phone,
      company: parsed.company || null,
      email: parsed.email || null,
      gstin: parsed.gstin || null,
      address: parsed.address || null,
      city: parsed.city || null,
      state: parsed.state || null,
      pincode: parsed.pincode || null,
      country: parsed.country || null,
      notes: parsed.notes || null,
      segment: parsed.segment ?? "RETAIL",
      status: parsed.status ?? "ACTIVE",
      creditLimit: parsed.creditLimit ?? null,
      portalEnabled: parsed.portalEnabled ?? false,
      portalEmail: parsed.portalEmail || null,
      packagingPreference: parsed.packagingPreference || null,
      exportRequirements: parsed.exportRequirements || null,
      moq: parsed.moq || null,
      distributorTerritory: parsed.distributorTerritory || null,
      seasonalNotes: parsed.seasonalNotes || null,
      contacts: {
        create: {
          name: parsed.name,
          email: parsed.email || null,
          phone: parsed.phone,
          isPrimary: true,
        },
      },
    },
  });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.CREATE,
    entityType: "Customer",
    entityId: customer.id,
    message: `Added customer ${customer.name}`,
  });

  revalidateCustomers();
  revalidatePath("/sales/new");
  return customer;
}

export async function updateCustomer(id: string, data: z.infer<typeof customerSchema>) {
  const user = await requirePermission("sales.edit");
  const parsed = customerSchema.parse(data);

  await prisma.customer.update({
    where: { id },
    data: {
      name: parsed.name,
      phone: parsed.phone,
      company: parsed.company || null,
      email: parsed.email || null,
      gstin: parsed.gstin || null,
      address: parsed.address || null,
      city: parsed.city || null,
      state: parsed.state || null,
      pincode: parsed.pincode || null,
      country: parsed.country || null,
      notes: parsed.notes || null,
      segment: parsed.segment,
      status: parsed.status,
      creditLimit: parsed.creditLimit ?? null,
      portalEnabled: parsed.portalEnabled,
      portalEmail: parsed.portalEmail || null,
      packagingPreference: parsed.packagingPreference || null,
      exportRequirements: parsed.exportRequirements || null,
      moq: parsed.moq || null,
      distributorTerritory: parsed.distributorTerritory || null,
      seasonalNotes: parsed.seasonalNotes || null,
    },
  });

  await logActivity({
    userId: user.id,
    action: ActivityAction.UPDATE,
    entityType: "Customer",
    entityId: id,
    message: `Updated customer ${parsed.name}`,
  });

  revalidateCustomers(id);
}

export async function addCustomerContact(
  customerId: string,
  data: { name: string; title?: string; email?: string; phone?: string; isPrimary?: boolean },
) {
  await requirePermission("sales.edit");
  if (data.isPrimary) {
    await prisma.customerContact.updateMany({
      where: { customerId },
      data: { isPrimary: false },
    });
  }
  await prisma.customerContact.create({
    data: {
      customerId,
      name: data.name,
      title: data.title || null,
      email: data.email || null,
      phone: data.phone || null,
      isPrimary: data.isPrimary ?? false,
    },
  });
  revalidateCustomers(customerId);
}

export async function addCustomerAddress(
  customerId: string,
  data: {
    type: CustomerAddressType;
    label?: string;
    line1: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    isDefault?: boolean;
  },
) {
  await requirePermission("sales.edit");
  if (data.isDefault) {
    await prisma.customerAddress.updateMany({
      where: { customerId, type: data.type },
      data: { isDefault: false },
    });
  }
  await prisma.customerAddress.create({ data: { customerId, ...data, line2: data.line2 || null } });
  revalidateCustomers(customerId);
}

export async function addCustomerCommunication(
  customerId: string,
  channel: CustomerCommChannel,
  message: string,
) {
  const user = await requirePermission("sales.edit");
  await prisma.customerCommunication.create({
    data: { customerId, channel, message, userId: user.id },
  });
  revalidateCustomers(customerId);
}

export async function addCustomerDocument(
  customerId: string,
  data: { docType: CustomerDocType; name: string; fileUrl?: string; notes?: string },
) {
  await requirePermission("sales.edit");
  await prisma.customerDocument.create({
    data: {
      customerId,
      docType: data.docType,
      name: data.name,
      fileUrl: data.fileUrl || null,
      notes: data.notes || null,
    },
  });
  revalidateCustomers(customerId);
}

export async function createSupportTicket(
  customerId: string,
  data: { subject: string; description?: string; priority?: SupportTicketPriority },
) {
  await requirePermission("sales.edit");
  const count = await prisma.customerSupportTicket.count();
  const ticketNumber = `TKT-2026-${String(count + 1).padStart(4, "0")}`;
  await prisma.customerSupportTicket.create({
    data: {
      customerId,
      ticketNumber,
      subject: data.subject,
      description: data.description || null,
      priority: data.priority ?? "MEDIUM",
    },
  });
  revalidateCustomers(customerId);
}

export async function updateCustomerStatus(id: string, status: CustomerStatus) {
  await requirePermission("sales.edit");
  await prisma.customer.update({ where: { id }, data: { status } });
  revalidateCustomers(id);
}

export async function toggleCustomerPortal(id: string, enabled: boolean, portalEmail?: string) {
  await requirePermission("sales.edit");
  await prisma.customer.update({
    where: { id },
    data: { portalEnabled: enabled, portalEmail: portalEmail || null },
  });
  revalidateCustomers(id);
}
