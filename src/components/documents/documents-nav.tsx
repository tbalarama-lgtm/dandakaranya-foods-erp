"use client";

import {
  LayoutGrid,
  Files,
  Building2,
  Share2,
  Clock,
  CheckCircle2,
  Archive,
  Trash2,
  Settings,
} from "lucide-react";
import { ModuleNav, type ModuleNavLink } from "@/components/layout/module-nav";

const links: ModuleNavLink[] = [
  { href: "/documents", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/documents/all", label: "All Documents", icon: Files },
  { href: "/documents/departments", label: "Departments", icon: Building2 },
  { href: "/documents/shared", label: "Shared", icon: Share2 },
  { href: "/documents/expiring", label: "Expiring Soon", icon: Clock },
  { href: "/documents/approvals", label: "Approvals", icon: CheckCircle2 },
  { href: "/documents/archive", label: "Archive", icon: Archive },
  { href: "/documents/trash", label: "Trash", icon: Trash2 },
  { href: "/documents/settings", label: "Settings", icon: Settings },
];

export function DocumentsNav() {
  return <ModuleNav links={links} />;
}
