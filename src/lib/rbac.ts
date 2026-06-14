import type { UserRole } from "@prisma/client";

export type Permission =
  | "dashboard.view"
  | "sales.view"
  | "sales.create"
  | "sales.edit"
  | "sales.delete"
  | "purchases.view"
  | "purchases.create"
  | "purchases.edit"
  | "vendors.view"
  | "vendors.create"
  | "leads.view"
  | "leads.create"
  | "leads.edit"
  | "leads.assign"
  | "inventory.view"
  | "inventory.edit"
  | "reports.view"
  | "activity.view"
  | "activity.export"
  | "users.manage"
  | "settings.manage"
  | "company.manage"
  | "production.view"
  | "production.manage"
  | "finance.view"
  | "finance.manage"
  | "hr.view"
  | "hr.manage"
  | "documents.view"
  | "documents.upload"
  | "documents.manage"
  | "documents.approve"
  | "documents.delete";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    "dashboard.view",
    "sales.view",
    "sales.create",
    "sales.edit",
    "sales.delete",
    "purchases.view",
    "purchases.create",
    "purchases.edit",
    "vendors.view",
    "vendors.create",
    "leads.view",
    "leads.create",
    "leads.edit",
    "leads.assign",
    "inventory.view",
    "inventory.edit",
    "reports.view",
    "activity.view",
    "activity.export",
    "users.manage",
    "settings.manage",
    "company.manage",
    "production.view",
    "production.manage",
    "finance.view",
    "finance.manage",
    "hr.view",
    "hr.manage",
    "documents.view",
    "documents.upload",
    "documents.manage",
    "documents.approve",
    "documents.delete",
  ],
  MANAGER: [
    "dashboard.view",
    "sales.view",
    "sales.create",
    "sales.edit",
    "purchases.view",
    "purchases.create",
    "purchases.edit",
    "vendors.view",
    "vendors.create",
    "leads.view",
    "leads.create",
    "leads.edit",
    "leads.assign",
    "inventory.view",
    "inventory.edit",
    "reports.view",
    "activity.view",
    "activity.export",
    "company.manage",
    "production.view",
    "production.manage",
    "finance.view",
    "hr.view",
    "documents.view",
    "documents.upload",
    "documents.manage",
    "documents.approve",
  ],
  SALES_EXECUTIVE: [
    "dashboard.view",
    "sales.view",
    "sales.create",
    "leads.view",
    "leads.create",
    "leads.edit",
    "inventory.view",
    "documents.view",
    "documents.upload",
  ],
  ACCOUNTANT: [
    "dashboard.view",
    "sales.view",
    "purchases.view",
    "purchases.create",
    "vendors.view",
    "vendors.create",
    "reports.view",
    "activity.view",
    "finance.view",
    "finance.manage",
    "documents.view",
    "documents.upload",
    "documents.manage",
    "documents.approve",
  ],
  HR_EXECUTIVE: [
    "dashboard.view",
    "hr.view",
    "hr.manage",
    "activity.view",
    "documents.view",
    "documents.upload",
    "documents.manage",
  ],
};

export function can(role: UserRole, permission: Permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function roleLabel(role: UserRole) {
  const labels: Record<UserRole, string> = {
    ADMIN: "Admin",
    MANAGER: "Manager",
    SALES_EXECUTIVE: "Sales Executive",
    ACCOUNTANT: "Accountant",
    HR_EXECUTIVE: "HR Executive",
  };
  return labels[role];
}

export function roleSidebarLabel(role: UserRole) {
  const labels: Record<UserRole, string> = {
    ADMIN: "Managing Admin",
    MANAGER: "Operations Manager",
    SALES_EXECUTIVE: "Sales Executive",
    ACCOUNTANT: "Finance & Accounts",
    HR_EXECUTIVE: "HR & People Ops",
  };
  return labels[role];
}
