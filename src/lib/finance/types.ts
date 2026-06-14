export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type FinanceDashboardMetrics = {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  outstandingPayments: number;
  pendingReceivables: number;
  monthlyCashFlow: number;
  gstPayable: number;
  bankBalance: number;
  purchaseVsSales: { month: string; sales: number; purchases: number }[];
  revenueTrend: { month: string; revenue: number; expenses: number; profit: number }[];
  expenseBreakdown: { name: string; value: number }[];
  cashFlowSeries: { month: string; inflow: number; outflow: number }[];
  healthScore: number;
  healthLabel: string;
};

export type SalesInvoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  branchName?: string;
  items: string;
  quantity: number;
  tax: number;
  total: number;
  paymentStatus: PaymentStatus;
  dueDate: string;
  invoiceDate: string;
};

export type PurchaseRecord = {
  id: string;
  purchaseNumber: string;
  vendorName: string;
  branchName?: string;
  total: number;
  paymentStatus: PaymentStatus;
  approvalStatus: ApprovalStatus;
  purchaseDate: string;
  grnStatus?: string;
};

export type ExpenseRecord = {
  id: string;
  category: string;
  description: string;
  amount: number;
  department?: string;
  branchName?: string;
  expenseDate: string;
  status: ApprovalStatus;
  receiptUrl?: string;
};

export type BankAccount = {
  id: string;
  name: string;
  bankName: string;
  accountNo: string;
  branchName?: string;
  balance: number;
  currency: string;
};

export type BankTransaction = {
  id: string;
  accountId: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER";
  amount: number;
  description: string;
  date: string;
  reconciled: boolean;
};

export type GstSummary = {
  outputTax: number;
  inputTaxCredit: number;
  netPayable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tdsPlaceholder: number;
  filingDueDate: string;
};

export type FinanceNotification = {
  id: string;
  type: "PAYMENT" | "INVOICE" | "GST" | "BUDGET" | "CASH" | "VENDOR";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  priority: "high" | "medium" | "low";
};

export type BudgetLine = {
  id: string;
  department: string;
  budgeted: number;
  actual: number;
  forecast: number;
};
