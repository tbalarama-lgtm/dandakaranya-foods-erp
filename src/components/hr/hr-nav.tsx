"use client";

import {
  LayoutGrid,
  Users,
  CalendarCheck,
  CalendarOff,
  Banknote,
  Briefcase,
  Target,
  BarChart3,
  Bell,
  CalendarDays,
  Clock,
  Fingerprint,
} from "lucide-react";
import { ModuleNav, type ModuleNavLink } from "@/components/layout/module-nav";

const links: ModuleNavLink[] = [
  { href: "/hr", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/hr/employees", label: "Employees", icon: Users },
  { href: "/hr/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/hr/attendance/biometric", label: "Biometric", icon: Fingerprint },
  { href: "/hr/leave", label: "Leave", icon: CalendarOff },
  { href: "/hr/payroll", label: "Payroll", icon: Banknote },
  { href: "/hr/recruitment", label: "Recruitment", icon: Briefcase },
  { href: "/hr/performance", label: "Performance", icon: Target },
  { href: "/hr/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/hr/shifts", label: "Shifts", icon: Clock },
  { href: "/hr/holidays", label: "Holidays", icon: CalendarDays },
  { href: "/hr/notifications", label: "Alerts", icon: Bell },
];

export function HrNav() {
  return <ModuleNav links={links} />;
}
