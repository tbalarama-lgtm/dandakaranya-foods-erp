"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { ICON_STROKE } from "@/lib/enterprise-ui";

const LABELS: Record<string, string> = {
  sales: "Sales",
  purchases: "Purchases",
  leads: "Leads",
  inventory: "Inventory",
  products: "Products",
  customers: "Customers",
  vendors: "Vendors",
  procurement: "Procurement Hub",
  rfq: "RFQ & Quotes",
  grn: "GRN & QC",
  approvals: "Approvals",
  payables: "Payables",
  budgets: "Budgets",
  reports: "Analytics",
  activity: "Activity Logs",
  company: "Company",
  users: "Users",
  settings: "Settings",
  notifications: "Notifications",
  search: "Search",
  new: "New",
  production: "Production",
  finance: "Finance",
  hr: "HR",
  branches: "Warehouses",
  orders: "Sales Orders",
  pipeline: "Pipeline",
  quotations: "Quotations",
  whatsapp: "WhatsApp",
  documents: "Document Vault",
  archive: "Archive",
  trash: "Trash",
  departments: "Departments",
  expiring: "Expiring",
  shared: "Shared",
  integrations: "Integrations",
  expenses: "Expenses",
  ledger: "Accounts",
  planning: "Production Planning",
  recipes: "BOM",
  employees: "Employees",
  attendance: "Attendance",
  payroll: "Payroll",
  quality: "Quality Control",
  batches: "Batch Tracking",
  gst: "GST",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => ({
    label: LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1),
    href: "/" + segments.slice(0, i + 1).join("/"),
    last: i === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-sm">
      <Link
        href="/"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-muted-foreground transition hover:bg-muted/60 hover:text-[#B68D40]"
      >
        <Home className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
        <span className="sr-only sm:not-sr-only">Home</span>
      </Link>
      {crumbs.map((c) => (
        <span key={c.href} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={ICON_STROKE} />
          {c.last ? (
            <span className="rounded-md bg-[#B68D40]/10 px-2 py-0.5 font-medium text-foreground">{c.label}</span>
          ) : (
            <Link
              href={c.href}
              className="rounded-lg px-2 py-0.5 text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
            >
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
