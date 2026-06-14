import type { DocumentDepartment, UserRole } from "@prisma/client";
import { can, type Permission } from "@/lib/rbac";

const ROLE_DEPARTMENTS: Record<UserRole, DocumentDepartment[] | "ALL"> = {
  ADMIN: "ALL",
  MANAGER: "ALL",
  HR_EXECUTIVE: ["HR"],
  ACCOUNTANT: ["FINANCE", "VENDOR_PROCUREMENT"],
  SALES_EXECUTIVE: ["SALES_MARKETING"],
};

export function canAccessDocuments(role: UserRole) {
  return can(role, "documents.view");
}

export function canUploadDocuments(role: UserRole) {
  return can(role, "documents.upload");
}

export function canManageDocuments(role: UserRole) {
  return can(role, "documents.manage");
}

export function canDeleteDocuments(role: UserRole) {
  return can(role, "documents.delete");
}

export function canApproveDocuments(role: UserRole) {
  return can(role, "documents.approve");
}

export function allowedDepartments(role: UserRole): DocumentDepartment[] | "ALL" {
  return ROLE_DEPARTMENTS[role] ?? [];
}

export function canAccessDepartment(role: UserRole, department: DocumentDepartment) {
  const allowed = allowedDepartments(role);
  if (allowed === "ALL") return true;
  return allowed.includes(department);
}

export function departmentFilter(role: UserRole): DocumentDepartment[] | undefined {
  const allowed = allowedDepartments(role);
  return allowed === "ALL" ? undefined : allowed;
}

export const PERMISSION_MATRIX: {
  role: UserRole;
  label: string;
  permissions: Permission[];
  departments: string;
}[] = [
  {
    role: "ADMIN",
    label: "Super Admin",
    permissions: ["documents.view", "documents.upload", "documents.manage", "documents.approve", "documents.delete"],
    departments: "All departments",
  },
  {
    role: "MANAGER",
    label: "Operations Manager",
    permissions: ["documents.view", "documents.upload", "documents.manage", "documents.approve"],
    departments: "All departments",
  },
  {
    role: "HR_EXECUTIVE",
    label: "HR Manager",
    permissions: ["documents.view", "documents.upload", "documents.manage"],
    departments: "HR only",
  },
  {
    role: "ACCOUNTANT",
    label: "Finance Manager",
    permissions: ["documents.view", "documents.upload", "documents.manage", "documents.approve"],
    departments: "Finance & Vendor",
  },
  {
    role: "SALES_EXECUTIVE",
    label: "Sales Team",
    permissions: ["documents.view", "documents.upload"],
    departments: "Sales & Marketing",
  },
];
