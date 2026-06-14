import type {
  CustomerCommChannel,
  CustomerCreditRisk,
  CustomerDocType,
  CustomerSegment,
  CustomerStatus,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@prisma/client";

export const HIGH_VALUE_THRESHOLD = 500_000;

export const CUSTOMER_SEGMENT_LABELS: Record<CustomerSegment, string> = {
  RETAIL: "Retail",
  DISTRIBUTOR: "Distributor",
  EXPORT: "Export",
  WHOLESALE: "Wholesale",
  INSTITUTIONAL: "Institutional",
};

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  BLOCKED: "Blocked",
};

export const CUSTOMER_STATUS_STYLES: Record<CustomerStatus, string> = {
  ACTIVE: "bg-emerald-500/12 text-emerald-700",
  INACTIVE: "bg-slate-500/12 text-slate-600",
  BLOCKED: "bg-red-500/12 text-red-700",
};

export const CUSTOMER_RISK_LABELS: Record<CustomerCreditRisk, string> = {
  LOW: "Low risk",
  MEDIUM: "Medium risk",
  HIGH: "High risk",
  CRITICAL: "Critical risk",
};

export const CUSTOMER_RISK_STYLES: Record<CustomerCreditRisk, string> = {
  LOW: "bg-emerald-500/12 text-emerald-700",
  MEDIUM: "bg-amber-500/12 text-amber-700",
  HIGH: "bg-orange-500/12 text-orange-700",
  CRITICAL: "bg-red-500/12 text-red-700",
};

export const CUSTOMER_DOC_LABELS: Record<CustomerDocType, string> = {
  GST_CERTIFICATE: "GST certificate",
  AGREEMENT: "Agreement",
  CONTRACT: "Contract",
  KYC: "KYC document",
  OTHER: "Other",
};

export const TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const TICKET_PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export type CustomerListDto = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string;
  gstin: string | null;
  segment: CustomerSegment;
  status: CustomerStatus;
  creditRisk: CustomerCreditRisk;
  country: string | null;
  portalEnabled: boolean;
  invoiceCount: number;
  orderCount: number;
  lifetimeValue: number;
  outstanding: number;
  overdueCount: number;
  isHighValue: boolean;
  lastOrderAt: string | null;
  creditLimit: number | null;
  creditUtilization: number;
};

export type CustomerDetailDto = CustomerListDto & {
  city: string | null;
  state: string | null;
  pincode: string | null;
  address: string | null;
  notes: string | null;
  creditLimit: number | null;
  portalEmail: string | null;
  packagingPreference: string | null;
  exportRequirements: string | null;
  moq: string | null;
  distributorTerritory: string | null;
  seasonalNotes: string | null;
  createdAt: string;
  contacts: {
    id: string;
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    isPrimary: boolean;
  }[];
  addresses: {
    id: string;
    type: "BILLING" | "SHIPPING";
    label: string | null;
    line1: string;
    line2: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    country: string | null;
    isDefault: boolean;
  }[];
};

export type CustomerAnalytics = {
  totalCustomers: number;
  activeCustomers: number;
  highValueCount: number;
  totalOutstanding: number;
  overdueInvoices: number;
  avgLifetimeValue: number;
  bySegment: { segment: CustomerSegment; count: number; revenue: number }[];
  topCustomers: { id: string; name: string; company: string | null; ltv: number }[];
  salesTrend: { month: string; revenue: number; orders: number }[];
  repeatRate: number;
};

export type CustomerLedgerEntry = {
  id: string;
  date: string;
  type: "INVOICE" | "PAYMENT";
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  status?: string;
};
