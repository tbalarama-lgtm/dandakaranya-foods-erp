"use client";

import {
  LayoutGrid,
  Calendar,
  ClipboardList,
  Package,
  Cog,
  ShieldCheck,
  Layers,
  Users,
  Wrench,
  Warehouse,
  FileText,
  Bell,
  FlaskConical,
  ScrollText,
  Calculator,
} from "lucide-react";
import { ModuleNav, type ModuleNavLink } from "@/components/layout/module-nav";

const links: ModuleNavLink[] = [
  { href: "/production", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/production/schedule", label: "Scheduling", icon: Calendar },
  { href: "/production/work-orders", label: "Work orders", icon: ClipboardList },
  { href: "/production/materials", label: "Materials", icon: Package },
  { href: "/production/machines", label: "Machines", icon: Cog },
  { href: "/production/quality", label: "Quality", icon: ShieldCheck },
  { href: "/production/batches", label: "Batches", icon: Layers },
  { href: "/production/staff", label: "Staff", icon: Users },
  { href: "/production/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/production/inventory", label: "Inventory", icon: Warehouse },
  { href: "/production/recipes", label: "Recipes", icon: FlaskConical },
  { href: "/production/logs", label: "Logs", icon: ScrollText },
  { href: "/production/reports", label: "Reports", icon: FileText },
  { href: "/production/costs", label: "Costs", icon: Calculator },
  { href: "/production/notifications", label: "Alerts", icon: Bell },
];

export function ProductionNav() {
  return <ModuleNav links={links} />;
}
