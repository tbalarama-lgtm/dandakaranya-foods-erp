import type {
  BankAccount,
  BankTransaction,
  BudgetLine,
  ExpenseRecord,
  FinanceDashboardMetrics,
  FinanceNotification,
  GstSummary,
  PurchaseRecord,
  SalesInvoice,
} from "./types";

export const FINANCE_BRANCHES = ["All branches", "Sukma HQ", "Raipur", "Mumbai"];

export const MOCK_SALES_INVOICES: SalesInvoice[] = [
  {
    id: "inv-1",
    invoiceNumber: "INV-2026-0142",
    customerName: "Global Spice Imports",
    branchName: "Sukma HQ",
    items: "Tamarind Husk Powder, Mango Pickle",
    quantity: 450,
    tax: 18900,
    total: 124500,
    paymentStatus: "PAID",
    dueDate: "2026-05-10",
    invoiceDate: "2026-05-01",
  },
  {
    id: "inv-2",
    invoiceNumber: "INV-2026-0143",
    customerName: "South India Distributors",
    branchName: "Raipur",
    items: "Organic Turmeric Powder",
    quantity: 200,
    tax: 7200,
    total: 47200,
    paymentStatus: "PENDING",
    dueDate: "2026-05-25",
    invoiceDate: "2026-05-12",
  },
  {
    id: "inv-3",
    invoiceNumber: "INV-2026-0144",
    customerName: "Metro Retail Chain",
    branchName: "Mumbai",
    items: "Assorted SKU bundle",
    quantity: 1200,
    tax: 45600,
    total: 298600,
    paymentStatus: "PARTIAL",
    dueDate: "2026-05-20",
    invoiceDate: "2026-05-08",
  },
  {
    id: "inv-4",
    invoiceNumber: "INV-2026-0145",
    customerName: "Export House Kerala",
    branchName: "Sukma HQ",
    items: "FSSAI certified mix",
    quantity: 800,
    tax: 28800,
    total: 188800,
    paymentStatus: "OVERDUE",
    dueDate: "2026-04-30",
    invoiceDate: "2026-04-15",
  },
];

export const MOCK_PURCHASES: PurchaseRecord[] = [
  {
    id: "po-1",
    purchaseNumber: "PO-2026-0089",
    vendorName: "Chhattisgarh Raw Materials Co.",
    branchName: "Sukma HQ",
    total: 85600,
    paymentStatus: "PAID",
    approvalStatus: "APPROVED",
    purchaseDate: "2026-05-05",
    grnStatus: "Received",
  },
  {
    id: "po-2",
    purchaseNumber: "PO-2026-0090",
    vendorName: "PackPro Industries",
    branchName: "Sukma HQ",
    total: 34200,
    paymentStatus: "PENDING",
    approvalStatus: "PENDING",
    purchaseDate: "2026-05-14",
    grnStatus: "Pending GRN",
  },
  {
    id: "po-3",
    purchaseNumber: "PO-2026-0091",
    vendorName: "LogiTrans South",
    branchName: "Raipur",
    total: 18500,
    paymentStatus: "PENDING",
    approvalStatus: "APPROVED",
    purchaseDate: "2026-05-16",
    grnStatus: "In transit",
  },
];

export const MOCK_EXPENSES: ExpenseRecord[] = [
  { id: "ex-1", category: "Salaries", description: "May payroll — production", amount: 420000, department: "Production", branchName: "Sukma HQ", expenseDate: "2026-05-01", status: "APPROVED" },
  { id: "ex-2", category: "Raw Materials", description: "Tamarind batch procurement", amount: 185000, department: "Procurement", branchName: "Sukma HQ", expenseDate: "2026-05-06", status: "APPROVED" },
  { id: "ex-3", category: "Utilities", description: "Electricity — plant", amount: 42000, department: "Operations", branchName: "Sukma HQ", expenseDate: "2026-05-10", status: "APPROVED" },
  { id: "ex-4", category: "Transportation", description: "Fleet diesel & freight", amount: 68000, department: "Logistics", branchName: "Raipur", expenseDate: "2026-05-11", status: "PENDING" },
  { id: "ex-5", category: "Marketing", description: "Trade fair booth", amount: 95000, department: "Sales", branchName: "Mumbai", expenseDate: "2026-05-15", status: "PENDING" },
  { id: "ex-6", category: "Packaging", description: "Laminated pouches Q2", amount: 72000, department: "Production", branchName: "Sukma HQ", expenseDate: "2026-05-17", status: "APPROVED" },
  { id: "ex-7", category: "Office Expenses", description: "Stationery & IT", amount: 12500, department: "Admin", branchName: "Sukma HQ", expenseDate: "2026-05-18", status: "APPROVED" },
];

export const MOCK_BANK_ACCOUNTS: BankAccount[] = [
  { id: "ba-1", name: "Operating Account", bankName: "HDFC Bank", accountNo: "****4521", branchName: "Sukma HQ", balance: 2845000, currency: "INR" },
  { id: "ba-2", name: "Payroll Account", bankName: "ICICI Bank", accountNo: "****8832", branchName: "Sukma HQ", balance: 890000, currency: "INR" },
  { id: "ba-3", name: "Export Collections", bankName: "SBI", accountNo: "****1109", branchName: "Mumbai", balance: 1250000, currency: "INR" },
];

export const MOCK_BANK_TRANSACTIONS: BankTransaction[] = [
  { id: "bt-1", accountId: "ba-1", type: "DEPOSIT", amount: 124500, description: "INV-2026-0142 payment", date: "2026-05-10", reconciled: true },
  { id: "bt-2", accountId: "ba-1", type: "WITHDRAWAL", amount: 85600, description: "PO-2026-0089 vendor", date: "2026-05-08", reconciled: true },
  { id: "bt-3", accountId: "ba-2", type: "WITHDRAWAL", amount: 420000, description: "Payroll May", date: "2026-05-01", reconciled: true },
  { id: "bt-4", accountId: "ba-1", type: "TRANSFER", amount: 150000, description: "Transfer to payroll", date: "2026-04-28", reconciled: false },
];

export const MOCK_GST: GstSummary = {
  outputTax: 186400,
  inputTaxCredit: 94200,
  netPayable: 92200,
  cgst: 46100,
  sgst: 46100,
  igst: 0,
  tdsPlaceholder: 12400,
  filingDueDate: "2026-06-20",
};

export const MOCK_BUDGET: BudgetLine[] = [
  { id: "b1", department: "Production", budgeted: 1200000, actual: 1085000, forecast: 1150000 },
  { id: "b2", department: "Sales & Marketing", budgeted: 450000, actual: 398000, forecast: 480000 },
  { id: "b3", department: "Logistics", budgeted: 280000, actual: 265000, forecast: 290000 },
  { id: "b4", department: "Admin & HR", budgeted: 320000, actual: 305000, forecast: 318000 },
];

export const MOCK_FINANCE_NOTIFICATIONS: FinanceNotification[] = [
  { id: "fn-1", type: "INVOICE", title: "Overdue invoice", message: "INV-2026-0145 — Export House Kerala ₹1,88,800 due.", createdAt: new Date().toISOString(), read: false, priority: "high" },
  { id: "fn-2", type: "GST", title: "GST filing reminder", message: "GSTR-3B due on 20 Jun 2026. Net payable ₹92,200.", createdAt: new Date().toISOString(), read: false, priority: "high" },
  { id: "fn-3", type: "PAYMENT", title: "Purchase approval pending", message: "PO-2026-0090 — PackPro Industries awaiting approval.", createdAt: new Date().toISOString(), read: false, priority: "medium" },
  { id: "fn-4", type: "BUDGET", title: "Marketing budget alert", message: "Sales & Marketing at 88% of monthly budget.", createdAt: new Date().toISOString(), read: true, priority: "medium" },
  { id: "fn-5", type: "VENDOR", title: "Vendor payment due", message: "LogiTrans South — ₹18,500 due in 3 days.", createdAt: new Date().toISOString(), read: true, priority: "low" },
];

export function getFinanceDashboardMetrics(): FinanceDashboardMetrics {
  const totalRevenue = 2842600;
  const totalExpenses = 1924500;
  const netProfit = totalRevenue - totalExpenses;
  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    outstandingPayments: 342000,
    pendingReceivables: 536800,
    monthlyCashFlow: 412000,
    gstPayable: MOCK_GST.netPayable,
    bankBalance: MOCK_BANK_ACCOUNTS.reduce((s, a) => s + a.balance, 0),
    purchaseVsSales: [
      { month: "Jan", sales: 2100000, purchases: 1450000 },
      { month: "Feb", sales: 2350000, purchases: 1580000 },
      { month: "Mar", sales: 2280000, purchases: 1620000 },
      { month: "Apr", sales: 2650000, purchases: 1780000 },
      { month: "May", sales: 2842600, purchases: 1924500 },
    ],
    revenueTrend: [
      { month: "Jan", revenue: 2100000, expenses: 1450000, profit: 650000 },
      { month: "Feb", revenue: 2350000, expenses: 1580000, profit: 770000 },
      { month: "Mar", revenue: 2280000, expenses: 1620000, profit: 660000 },
      { month: "Apr", revenue: 2650000, expenses: 1780000, profit: 870000 },
      { month: "May", revenue: 2842600, expenses: 1924500, profit: 918100 },
    ],
    expenseBreakdown: [
      { name: "Salaries", value: 420000 },
      { name: "Raw Materials", value: 385000 },
      { name: "Logistics", value: 168000 },
      { name: "Utilities", value: 92000 },
      { name: "Marketing", value: 145000 },
      { name: "Packaging", value: 112000 },
      { name: "Other", value: 68000 },
    ],
    cashFlowSeries: [
      { month: "Jan", inflow: 1980000, outflow: 1520000 },
      { month: "Feb", inflow: 2200000, outflow: 1650000 },
      { month: "Mar", inflow: 2150000, outflow: 1700000 },
      { month: "Apr", inflow: 2480000, outflow: 1850000 },
      { month: "May", inflow: 2650000, outflow: 1924500 },
    ],
    healthScore: 78,
    healthLabel: "Strong",
  };
}

export const MOCK_INVENTORY_VALUATION = {
  totalValue: 1845000,
  rawMaterials: 920000,
  finishedGoods: 725000,
  packaging: 198000,
  movementImpact: -42000,
  topProducts: [
    { name: "Tamarind Husk Powder", revenue: 680000, cost: 412000, margin: 39 },
    { name: "Organic Turmeric", revenue: 520000, cost: 318000, margin: 39 },
    { name: "Mango Pickle", revenue: 410000, cost: 285000, margin: 30 },
  ],
};

export const MOCK_PAYROLL_FINANCE = {
  monthlyPayroll: 420000,
  bonusPaid: 85000,
  deductions: 52000,
  history: [
    { month: "Jan", amount: 398000 },
    { month: "Feb", amount: 405000 },
    { month: "Mar", amount: 410000 },
    { month: "Apr", amount: 415000 },
    { month: "May", amount: 420000 },
  ],
};

export const REPORT_TYPES = [
  "Profit & Loss",
  "Balance Sheet",
  "Cash Flow",
  "Trial Balance",
  "Sales Report",
  "Expense Report",
  "Tax Report",
] as const;
