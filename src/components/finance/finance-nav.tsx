"use client";

import {
  LayoutGrid,
  ShoppingCart,
  Truck,
  Receipt,
  Landmark,
  Scale,
  Users,
  Package,
  FileText,
  Target,
  Bell,
  TrendingUp,
  BookOpen,
  Wallet,
} from "lucide-react";
import { ModuleNav, type ModuleNavLink } from "@/components/layout/module-nav";

const links: ModuleNavLink[] = [
  { href: "/finance", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/finance/sales", label: "Sales", icon: ShoppingCart },
  { href: "/finance/purchases", label: "Purchases", icon: Truck },
  { href: "/finance/expenses", label: "Expenses", icon: Receipt },
  { href: "/finance/cash-bank", label: "Cash & Bank", icon: Landmark },
  { href: "/finance/gst", label: "GST & Tax", icon: Scale },
  { href: "/finance/payroll", label: "Payroll", icon: Users },
  { href: "/finance/inventory", label: "Inventory", icon: Package },
  { href: "/finance/reports", label: "Reports", icon: FileText },
  { href: "/finance/budget", label: "Budget", icon: Target },
  { href: "/finance/profit-loss", label: "P&L", icon: TrendingUp },
  { href: "/finance/ledger", label: "Ledger", icon: BookOpen },
  { href: "/finance/cash-flow", label: "Cash flow", icon: Wallet },
  { href: "/finance/notifications", label: "Alerts", icon: Bell },
];

export function FinanceNav() {
  return <ModuleNav links={links} />;
}
