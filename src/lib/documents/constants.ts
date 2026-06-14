import type { DocumentDepartment } from "@prisma/client";

export type FolderSeed = {
  slug: string;
  name: string;
  department: DocumentDepartment;
  children?: FolderSeed[];
};

export const DOCUMENT_FOLDER_TREE: FolderSeed[] = [
  {
    slug: "company-legal",
    name: "Company Legal",
    department: "COMPANY_LEGAL",
    children: [
      { slug: "gst", name: "GST", department: "COMPANY_LEGAL" },
      { slug: "pan", name: "PAN", department: "COMPANY_LEGAL" },
      { slug: "incorporation-certificate", name: "Incorporation Certificate", department: "COMPANY_LEGAL" },
      { slug: "fssai", name: "FSSAI", department: "COMPANY_LEGAL" },
      { slug: "trade-license", name: "Trade License", department: "COMPANY_LEGAL" },
      { slug: "trademark", name: "Trademark", department: "COMPANY_LEGAL" },
      { slug: "msme", name: "MSME", department: "COMPANY_LEGAL" },
      { slug: "iso-certificates", name: "ISO Certificates", department: "COMPANY_LEGAL" },
    ],
  },
  {
    slug: "hr-documents",
    name: "HR Documents",
    department: "HR",
    children: [
      { slug: "employee-contracts", name: "Employee Contracts", department: "HR" },
      { slug: "offer-letters", name: "Offer Letters", department: "HR" },
      { slug: "id-proofs", name: "ID Proofs", department: "HR" },
      { slug: "payroll-records", name: "Payroll Records", department: "HR" },
      { slug: "attendance-reports", name: "Attendance Reports", department: "HR" },
      { slug: "policies", name: "Policies", department: "HR" },
    ],
  },
  {
    slug: "finance",
    name: "Finance",
    department: "FINANCE",
    children: [
      { slug: "invoices", name: "Invoices", department: "FINANCE" },
      { slug: "purchase-orders", name: "Purchase Orders", department: "FINANCE" },
      { slug: "bank-statements", name: "Bank Statements", department: "FINANCE" },
      { slug: "tax-filings", name: "Tax Filings", department: "FINANCE" },
      { slug: "audit-reports", name: "Audit Reports", department: "FINANCE" },
      { slug: "expense-bills", name: "Expense Bills", department: "FINANCE" },
    ],
  },
  {
    slug: "production-quality",
    name: "Production & Quality",
    department: "PRODUCTION",
    children: [
      { slug: "sops", name: "SOPs", department: "PRODUCTION" },
      { slug: "lab-reports", name: "Lab Reports", department: "PRODUCTION" },
      { slug: "batch-records", name: "Batch Records", department: "PRODUCTION" },
      { slug: "qc-reports", name: "QC Reports", department: "PRODUCTION" },
      { slug: "product-formulations", name: "Product Formulations", department: "PRODUCTION" },
    ],
  },
  {
    slug: "vendor-procurement",
    name: "Vendor & Procurement",
    department: "VENDOR_PROCUREMENT",
    children: [
      { slug: "vendor-agreements", name: "Vendor Agreements", department: "VENDOR_PROCUREMENT" },
      { slug: "quotations", name: "Quotations", department: "VENDOR_PROCUREMENT" },
      { slug: "delivery-challans", name: "Delivery Challans", department: "VENDOR_PROCUREMENT" },
      { slug: "supplier-certifications", name: "Supplier Certifications", department: "VENDOR_PROCUREMENT" },
    ],
  },
  {
    slug: "sales-marketing",
    name: "Sales & Marketing",
    department: "SALES_MARKETING",
    children: [
      { slug: "brochures", name: "Brochures", department: "SALES_MARKETING" },
      { slug: "packaging-designs", name: "Packaging Designs", department: "SALES_MARKETING" },
      { slug: "product-images", name: "Product Images", department: "SALES_MARKETING" },
      { slug: "banners", name: "Banners", department: "SALES_MARKETING" },
      { slug: "distributor-agreements", name: "Distributor Agreements", department: "SALES_MARKETING" },
    ],
  },
  {
    slug: "rd",
    name: "R&D",
    department: "RD",
    children: [
      { slug: "research-files", name: "Research Files", department: "RD" },
      { slug: "product-trials", name: "Product Trials", department: "RD" },
      { slug: "formulation-data", name: "Formulation Data", department: "RD" },
    ],
  },
];

export const DOCUMENT_TAGS = [
  "Confidential",
  "Legal",
  "Urgent",
  "Approved",
  "Pending",
  "Expiring Soon",
] as const;

export const DEPARTMENT_LABELS: Record<DocumentDepartment, string> = {
  COMPANY_LEGAL: "Company Legal",
  HR: "HR",
  FINANCE: "Finance",
  PRODUCTION: "Production & Quality",
  VENDOR_PROCUREMENT: "Vendor & Procurement",
  SALES_MARKETING: "Sales & Marketing",
  RD: "R&D",
};

export const WORKFLOW_LABELS = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  ARCHIVED: "Archived",
  REJECTED: "Rejected",
} as const;
