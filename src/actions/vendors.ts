"use server";

import { revalidatePath } from "next/cache";
import { ActivityAction, VendorClassification, VendorDocType, VendorPaymentTerms, VendorStatus } from "@prisma/client";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { can } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/session";

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().email().optional(),
);

const schema = z.object({
  name: z.string().trim().min(2, "Vendor name must be at least 2 characters."),
  code: z.string().optional(),
  phone: z.string().optional(),
  contact: z.string().optional(),
  email: optionalEmail,
  gstin: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  notes: z.string().optional(),
  classification: z.nativeEnum(VendorClassification).optional(),
  status: z.nativeEnum(VendorStatus).optional(),
  paymentTerms: z.nativeEnum(VendorPaymentTerms).optional(),
  fssaiNumber: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankIfsc: z.string().optional(),
  isFpoPartner: z.boolean().optional(),
  fpoRegion: z.string().optional(),
  seasonalNotes: z.string().optional(),
  moistureLimitPct: z.coerce.number().optional(),
  qualityScore: z.coerce.number().min(0).max(100).optional(),
  deliveryScore: z.coerce.number().min(0).max(100).optional(),
});

function vendorData(parsed: z.infer<typeof schema>) {
  return {
    name: parsed.name,
    code: parsed.code?.trim() || null,
    phone: parsed.phone?.trim() || null,
    contact: parsed.contact?.trim() || null,
    email: parsed.email?.trim() || null,
    gstin: parsed.gstin?.trim() || null,
    address: parsed.address?.trim() || null,
    city: parsed.city?.trim() || null,
    state: parsed.state?.trim() || null,
    pincode: parsed.pincode?.trim() || null,
    notes: parsed.notes?.trim() || null,
    classification: parsed.classification ?? VendorClassification.RAW_MATERIAL,
    status: parsed.status ?? VendorStatus.ACTIVE,
    paymentTerms: parsed.paymentTerms ?? VendorPaymentTerms.NET_30,
    fssaiNumber: parsed.fssaiNumber?.trim() || null,
    bankName: parsed.bankName?.trim() || null,
    bankAccount: parsed.bankAccount?.trim() || null,
    bankIfsc: parsed.bankIfsc?.trim() || null,
    isFpoPartner: parsed.isFpoPartner ?? false,
    fpoRegion: parsed.fpoRegion?.trim() || null,
    seasonalNotes: parsed.seasonalNotes?.trim() || null,
    moistureLimitPct: parsed.moistureLimitPct ?? null,
    qualityScore: parsed.qualityScore ?? null,
    deliveryScore: parsed.deliveryScore ?? null,
  };
}

function revalidateVendors(id?: string) {
  revalidatePath("/vendors");
  revalidatePath("/procurement");
  revalidatePath("/purchases/new");
  if (id) revalidatePath(`/vendors/${id}`);
}

export async function createVendor(data: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return actionFail("Please sign in again.");
  if (!can(user.role, "vendors.create")) {
    return actionFail("Your role cannot add vendors. Ask an admin or manager.");
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid vendor details.");
  }

  try {
    const vendor = await prisma.vendor.create({ data: vendorData(parsed.data) });

    await logActivity({
      userId: user.id,
      userName: user.name,
      action: ActivityAction.CREATE,
      entityType: "Vendor",
      entityId: vendor.id,
      message: `Added vendor ${vendor.name}`,
    });

    revalidateVendors();
    return actionOk({ id: vendor.id });
  } catch (error) {
    console.error("[createVendor]", error);
    return actionFail("Could not save vendor. Check your connection and try again.");
  }
}

export async function updateVendor(id: string, data: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return actionFail("Please sign in again.");
  if (!can(user.role, "vendors.create")) {
    return actionFail("Your role cannot edit vendors. Ask an admin or manager.");
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid vendor details.");
  }

  try {
    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) return actionFail("Vendor not found.");

    const vendor = await prisma.vendor.update({
      where: { id },
      data: vendorData(parsed.data),
    });

    await logActivity({
      userId: user.id,
      userName: user.name,
      action: ActivityAction.UPDATE,
      entityType: "Vendor",
      entityId: vendor.id,
      message: `Updated vendor ${vendor.name}`,
    });

    revalidateVendors(id);
    revalidatePath("/purchases");
    return actionOk({ id: vendor.id });
  } catch (error) {
    console.error("[updateVendor]", error);
    return actionFail("Could not update vendor. Check your connection and try again.");
  }
}

export async function bulkUpdateVendorStatus(ids: string[], status: VendorStatus): Promise<ActionResult<{ count: number }>> {
  const user = await getCurrentUser();
  if (!user) return actionFail("Please sign in again.");
  if (!can(user.role, "vendors.create")) return actionFail("Insufficient permissions.");

  await prisma.vendor.updateMany({ where: { id: { in: ids } }, data: { status } });
  revalidateVendors();
  return actionOk({ count: ids.length });
}

export async function addVendorDocument(
  vendorId: string,
  data: { docType: VendorDocType; name: string; fileUrl?: string; expiresAt?: string; notes?: string },
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return actionFail("Please sign in again.");
  if (!can(user.role, "vendors.create")) return actionFail("Insufficient permissions.");

  const doc = await prisma.vendorDocument.create({
    data: {
      vendorId,
      docType: data.docType,
      name: data.name,
      fileUrl: data.fileUrl || null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      notes: data.notes || null,
    },
  });

  revalidateVendors(vendorId);
  return actionOk({ id: doc.id });
}
