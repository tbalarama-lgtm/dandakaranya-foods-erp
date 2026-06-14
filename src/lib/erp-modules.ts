import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  TrendingUp,
  ShoppingCart,
  Truck,
  Factory,
  Warehouse,
  Landmark,
  Users,
  MessageSquare,
  ShieldCheck,
  Route,
  FolderLock,
  BarChart3,
  Settings2,
} from "lucide-react";
import type { UserRole } from "@prisma/client";

/** Canonical 13-module ERP map for Dandakaranya Foods */
export type ErpModuleId =
  | "executive"
  | "sales"
  | "purchase"
  | "production"
  | "inventory"
  | "finance"
  | "hr"
  | "crm"
  | "quality"
  | "logistics"
  | "documents"
  | "reports"
  | "admin";

export type ErpModule = {
  id: ErpModuleId;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  roles?: UserRole[];
};

export const ERP_MODULES: ErpModule[] = [
  {
    id: "executive",
    label: "Executive Dashboard",
    description: "KPIs, alerts, pipeline, and command-center widgets",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    id: "sales",
    label: "Sales Management",
    description: "Invoices, orders, quotations, and GST",
    href: "/sales",
    icon: ShoppingCart,
  },
  {
    id: "purchase",
    label: "Purchase Management",
    description: "Procurement, RFQ, PO, GRN, approvals, and payables",
    href: "/procurement",
    icon: Truck,
    roles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
  },
  {
    id: "production",
    label: "Production Management",
    description: "Planning, BOM, work orders, batches, and OEE",
    href: "/production",
    icon: Factory,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    id: "inventory",
    label: "Inventory Management",
    description: "Stock levels, products, warehouses, and batch trace",
    href: "/inventory",
    icon: Warehouse,
  },
  {
    id: "finance",
    label: "Finance & Accounting",
    description: "Ledger, expenses, GST, P&L, and cash flow",
    href: "/finance",
    icon: Landmark,
    roles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
  },
  {
    id: "hr",
    label: "HR & Payroll",
    description: "Employees, attendance, leave, payroll, and recruitment",
    href: "/hr",
    icon: Users,
    roles: ["ADMIN", "MANAGER", "HR_EXECUTIVE"],
  },
  {
    id: "crm",
    label: "CRM & Leads",
    description: "Lead pipeline, customers, and communications",
    href: "/leads",
    icon: MessageSquare,
  },
  {
    id: "quality",
    label: "Quality Control",
    description: "GRN inspection, batch QC, compliance, and holds",
    href: "/quality",
    icon: ShieldCheck,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    id: "logistics",
    label: "Logistics & Dispatch",
    description: "Warehouses, pick-pack-dispatch, transfers, and branches",
    href: "/logistics",
    icon: Route,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    id: "documents",
    label: "Document Vault",
    description: "Secure storage, approvals, and department ACLs",
    href: "/documents",
    icon: FolderLock,
  },
  {
    id: "reports",
    label: "Reports & Analytics",
    description: "P&L, pipeline, exports, and cross-module analytics",
    href: "/reports",
    icon: BarChart3,
    roles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
  },
  {
    id: "admin",
    label: "Admin Console",
    description: "Users, roles, activity logs, company, and integrations",
    href: "/admin",
    icon: Settings2,
    roles: ["ADMIN"],
  },
];

export function modulesForRole(role: UserRole): ErpModule[] {
  return ERP_MODULES.filter((m) => !m.roles || m.roles.includes(role));
}
