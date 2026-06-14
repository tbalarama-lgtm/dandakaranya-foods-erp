"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { saveEmployeePhotoFile } from "@/lib/hr/employee-photos";
import {
  getEmployee,
  parseEmployeeFormData,
  resolveAadhaarAuthorization,
  saveEmployee,
} from "@/lib/hr/employee-store";
import { normalizeIfsc, validateEmployeeCompliance } from "@/lib/hr/employee-validation";
import type { Employee } from "@/lib/hr/types";
import { requirePermission } from "@/lib/session";

export type EmployeeMutationResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function requiredFields(data: ReturnType<typeof parseEmployeeFormData>) {
  if (!data.employeeNo || !data.name || !data.email || !data.phone) {
    return "Employee ID, name, email, and phone are required";
  }
  if (!data.department || !data.designation || !data.joinedAt) {
    return "Department, designation, and joining date are required";
  }
  return validateEmployeeCompliance(data);
}

function normalizeBankFields(data: ReturnType<typeof parseEmployeeFormData>) {
  return {
    ...data,
    bankIfsc: data.bankIfsc ? normalizeIfsc(data.bankIfsc) : undefined,
  };
}

async function photoFromForm(formData: FormData) {
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) return photo;
  return null;
}

export async function createEmployee(formData: FormData): Promise<EmployeeMutationResult> {
  try {
    await requirePermission("hr.manage");
    const parsed = parseEmployeeFormData(formData);
    const missing = requiredFields(parsed);
    if (missing) return { ok: false, error: missing };

    const fields = normalizeBankFields(parsed);
    const aadhaar = resolveAadhaarAuthorization(fields);

    const id = randomUUID();
    let photoUrl: string | null = null;
    const photo = await photoFromForm(formData);
    if (photo) {
      const saved = await saveEmployeePhotoFile(id, photo);
      photoUrl = saved.photoUrl;
    }

    const employee: Employee = { id, ...fields, ...aadhaar, photoUrl };
    await saveEmployee(employee);
    revalidatePath("/hr/employees");
    revalidatePath(`/hr/employees/${id}`);

    return { ok: true, id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create employee",
    };
  }
}

export async function updateEmployee(
  id: string,
  formData: FormData,
): Promise<EmployeeMutationResult> {
  try {
    await requirePermission("hr.manage");
    const existing = await getEmployee(id);
    if (!existing) return { ok: false, error: "Employee not found" };

    const parsed = parseEmployeeFormData(formData);
    const missing = requiredFields(parsed);
    if (missing) return { ok: false, error: missing };

    const fields = normalizeBankFields(parsed);
    const aadhaar = resolveAadhaarAuthorization(fields, existing);

    let photoUrl = existing.photoUrl ?? null;
    const photo = await photoFromForm(formData);
    if (photo) {
      const saved = await saveEmployeePhotoFile(id, photo);
      photoUrl = saved.photoUrl;
    }

    const employee: Employee = { id, ...fields, ...aadhaar, photoUrl };
    await saveEmployee(employee);
    revalidatePath("/hr/employees");
    revalidatePath(`/hr/employees/${id}`);
    revalidatePath(`/hr/employees/${id}/edit`);

    return { ok: true, id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update employee",
    };
  }
}
