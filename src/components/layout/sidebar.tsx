"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { BrandLogoImage } from "@/components/brand/brand-logo-image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  LayoutDashboard,
  BarChart3,
  Bell,
  MessageSquare,
  GitBranch,
  Users,
  FileText,
  ClipboardList,
  Receipt,
  Building2,
  Truck,
  PackageCheck,
  FileSpreadsheet,
  Warehouse,
  MapPin,
  Layers,
  CalendarClock,
  ListTree,
  ShieldCheck,
  Landmark,
  Wallet,
  Scale,
  PieChart,
  UserSquare2,
  Clock,
  Banknote,
  UserCog,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronDown,
  FolderLock,
  LogOut,
  X,
  Factory,
  Route,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can, roleSidebarLabel } from "@/lib/rbac";
import { sidebarBadgeForHref, type SidebarBadges } from "@/lib/sidebar-badges";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { UserRole } from "@prisma/client";

const ICON_STROKE = 1.75;
const SIDEBAR_EXPANDED = 280;
const SIDEBAR_COLLAPSED = 88;

type NavItem = { href: string; label: string; icon: React.ElementType; roles?: UserRole[] };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Executive",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/reports", label: "Analytics", icon: BarChart3, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { href: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "Sales Management",
    items: [
      { href: "/sales", label: "Invoices", icon: Receipt },
      { href: "/sales/orders", label: "Sales Orders", icon: ClipboardList },
      { href: "/quotations", label: "Quotations", icon: FileText },
    ],
  },
  {
    title: "CRM & Leads",
    items: [
      { href: "/leads", label: "Leads", icon: MessageSquare },
      { href: "/leads/pipeline", label: "Pipeline", icon: GitBranch },
      { href: "/customers", label: "Customers", icon: Users },
    ],
  },
  {
    title: "Purchase Management",
    items: [
      { href: "/procurement", label: "Procurement Hub", icon: BarChart3, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { href: "/vendors", label: "Vendors", icon: Building2, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { href: "/procurement/rfq", label: "RFQ & Sourcing", icon: FileText, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { href: "/purchases", label: "Purchase Orders", icon: Truck, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { href: "/procurement/grn", label: "GRN & QC", icon: PackageCheck, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { href: "/procurement/approvals", label: "Approvals", icon: ClipboardList, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { href: "/procurement/payables", label: "Payables", icon: FileSpreadsheet, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
    ],
  },
  {
    title: "Production",
    items: [
      { href: "/production", label: "Overview", icon: Factory, roles: ["ADMIN", "MANAGER"] },
      { href: "/production/planning", label: "Planning", icon: CalendarClock, roles: ["ADMIN", "MANAGER"] },
      { href: "/production/recipes", label: "BOM / Recipes", icon: ListTree, roles: ["ADMIN", "MANAGER"] },
      { href: "/production/work-orders", label: "Work Orders", icon: ClipboardList, roles: ["ADMIN", "MANAGER"] },
      { href: "/production/batches", label: "Batches", icon: Layers, roles: ["ADMIN", "MANAGER"] },
    ],
  },
  {
    title: "Inventory",
    items: [
      { href: "/inventory", label: "Stock", icon: Warehouse },
      { href: "/products", label: "Products", icon: PackageCheck },
      { href: "/warehouses", label: "Warehouses", icon: MapPin, roles: ["ADMIN", "MANAGER"] },
    ],
  },
  {
    title: "Quality Control",
    items: [
      { href: "/quality", label: "QC Center", icon: ShieldCheck, roles: ["ADMIN", "MANAGER"] },
      { href: "/procurement/grn", label: "Incoming QC", icon: PackageCheck, roles: ["ADMIN", "MANAGER"] },
      { href: "/production/quality", label: "Production QC", icon: ShieldCheck, roles: ["ADMIN", "MANAGER"] },
    ],
  },
  {
    title: "Logistics & Dispatch",
    items: [
      { href: "/logistics", label: "Logistics Hub", icon: Route, roles: ["ADMIN", "MANAGER"] },
      { href: "/warehouses/dispatch", label: "Dispatch", icon: Truck, roles: ["ADMIN", "MANAGER"] },
      { href: "/warehouses/transfers", label: "Transfers", icon: GitBranch, roles: ["ADMIN", "MANAGER"] },
      { href: "/branches", label: "Branches", icon: MapPin, roles: ["ADMIN", "MANAGER"] },
    ],
  },
  {
    title: "Finance & Accounting",
    items: [
      { href: "/finance", label: "Overview", icon: Landmark, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { href: "/finance/ledger", label: "Ledger", icon: Landmark, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { href: "/finance/expenses", label: "Expenses", icon: Wallet, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { href: "/finance/gst", label: "GST & Tax", icon: Scale, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { href: "/finance/profit-loss", label: "P&L", icon: PieChart, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { href: "/finance/cash-flow", label: "Cash Flow", icon: Wallet, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
    ],
  },
  {
    title: "HR & Payroll",
    items: [
      { href: "/hr", label: "Overview", icon: UserSquare2, roles: ["ADMIN", "MANAGER", "HR_EXECUTIVE"] },
      { href: "/hr/employees", label: "Employees", icon: UserSquare2, roles: ["ADMIN", "MANAGER", "HR_EXECUTIVE"] },
      { href: "/hr/attendance", label: "Attendance", icon: Clock, roles: ["ADMIN", "MANAGER", "HR_EXECUTIVE"] },
      { href: "/hr/payroll", label: "Payroll", icon: Banknote, roles: ["ADMIN", "MANAGER", "HR_EXECUTIVE"] },
      { href: "/hr/recruitment", label: "Recruitment", icon: Users, roles: ["ADMIN", "MANAGER", "HR_EXECUTIVE"] },
    ],
  },
  {
    title: "Document Vault",
    items: [{ href: "/documents", label: "Document Vault", icon: FolderLock }],
  },
  {
    title: "Admin Console",
    items: [
      { href: "/admin", label: "Admin Console", icon: Settings2, roles: ["ADMIN"] },
      { href: "/users", label: "Users", icon: UserCog, roles: ["ADMIN"] },
      { href: "/activity", label: "Activity Logs", icon: ScrollText, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { href: "/company", label: "Company", icon: Building2, roles: ["ADMIN"] },
      { href: "/settings", label: "Settings", icon: Settings, roles: ["ADMIN"] },
    ],
  },
];

function resolveActiveHref(pathname: string, hrefs: string[]) {
  const sorted = [...hrefs].sort((a, b) => b.length - a.length);
  return sorted.find((href) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`),
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function NavStatusDot({ variant }: { variant: "red" | "yellow" | "green" }) {
  return (
    <span
      className={cn(
        "sidebar-status-dot",
        variant === "red" && "sidebar-status-dot-red",
        variant === "yellow" && "sidebar-status-dot-yellow",
        variant === "green" && "sidebar-status-dot-green animate-pulse",
      )}
      aria-hidden
    />
  );
}

function SidebarNavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  badge,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  collapsed: boolean;
  badge: "red" | "yellow" | "green" | null;
  onNavigate?: () => void;
}) {
  return (
    <Link href={href} title={collapsed ? label : undefined} onClick={onNavigate} className="block">
      <motion.span
        whileHover={active ? undefined : { x: 2 }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn(
          "sidebar-nav-link group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]",
          active
            ? "sidebar-nav-link-active font-semibold text-[#E5E7EB]"
            : "font-medium text-[#94A3B8] hover:text-[#E5E7EB]",
          collapsed && "justify-center px-2.5",
        )}
      >
        {active && (
          <motion.span
            layoutId="sidebar-active-bar"
            className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-[#B68D40] shadow-[0_0_12px_rgba(182,141,64,0.55)]"
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          />
        )}

        <span className="relative shrink-0">
          <Icon
            className={cn("h-5 w-5 transition-colors", active ? "text-[#B68D40]" : "text-[#94A3B8] group-hover:text-[#E5E7EB]")}
            strokeWidth={ICON_STROKE}
          />
          {collapsed && badge && (
            <span className="absolute -right-0.5 -top-0.5">
              <NavStatusDot variant={badge} />
            </span>
          )}
        </span>

        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate leading-snug">{label}</span>
            {badge && <NavStatusDot variant={badge} />}
          </>
        )}
      </motion.span>
    </Link>
  );
}

function SidebarUserFooter({
  user,
  collapsed,
}: {
  user: { name: string; email: string; role: UserRole };
  collapsed: boolean;
}) {
  const showSettings = can(user.role, "settings.manage");

  if (collapsed) {
    return (
      <div className="px-3 pb-4 pt-2">
        <motion.div
          whileHover={{ scale: 1.04 }}
          className="sidebar-profile-card flex justify-center p-2.5"
          title={`${user.name} · ${roleSidebarLabel(user.role)}`}
        >
          <div className="relative">
            <Avatar className="h-10 w-10 border border-[#B68D40]/30 shadow-[0_4px_16px_rgba(0,0,0,0.35)]">
              <AvatarFallback className="bg-gradient-to-br from-[#B68D40] to-[#967235] text-xs font-semibold text-[#071226]">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#08182F] bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="px-3 pb-4 pt-2">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        whileHover={{ y: -2 }}
        className="sidebar-profile-card p-3.5"
      >
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <Avatar className="h-11 w-11 border border-[#B68D40]/35 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
              <AvatarFallback className="bg-gradient-to-br from-[#B68D40] to-[#967235] text-sm font-semibold text-[#071226]">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#08182F] bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-[#E5E7EB]">{user.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-[#94A3B8]">{user.email}</p>
            <span className="sidebar-role-badge mt-2">{roleSidebarLabel(user.role)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1 border-t border-white/[0.06] pt-3">
          {showSettings && (
            <Link
              href="/settings"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-[#94A3B8] transition hover:bg-[#102544] hover:text-[#E5E7EB]"
            >
              <Settings className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
              Settings
            </Link>
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-[#94A3B8] transition hover:bg-red-500/10 hover:text-red-300",
              showSettings ? "flex-1" : "w-full",
            )}
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
            Sign out
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function Sidebar({
  user,
  collapsed,
  sidebarBadges,
  onToggleCollapse,
  isMobile = false,
  mobileOpen = false,
  onMobileClose,
}: {
  user: { name: string; email: string; role: UserRole };
  collapsed: boolean;
  sidebarBadges: SidebarBadges;
  onToggleCollapse: () => void;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((n) => !n.roles || n.roles.includes(user.role)),
  })).filter((group) => group.items.length > 0);

  const allHrefs = visibleGroups.flatMap((group) => group.items.map((item) => item.href));
  const activeHref = resolveActiveHref(pathname, allHrefs);
  const showLabels = isMobile || !collapsed;
  const width = isMobile ? SIDEBAR_EXPANDED : collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  const sidebarContent = (
    <motion.aside
      initial={false}
      animate={{ width }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "erp-sidebar flex h-full shrink-0 flex-col font-sans text-[#E5E7EB]",
        isMobile ? "w-[280px] shadow-[4px_0_48px_rgba(0,0,0,0.45)]" : "sticky top-0 h-screen",
      )}
    >
      <div
        className={cn(
          "sidebar-brand relative flex shrink-0 items-center gap-3 px-4",
          !showLabels ? "h-[5.25rem] justify-center px-3" : "h-[5.5rem]",
        )}
      >
        <BrandLogoImage size={!showLabels ? 44 : 48} priority className="sidebar-brand-logo" />
        {showLabels && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="min-w-0 flex-1 pr-9"
          >
            <p className="truncate text-base font-bold leading-tight tracking-tight text-[#E5E7EB]">
              Dandakaranya
            </p>
            <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-[0.18em] text-[#94A3B8]">
              Enterprise ERP
            </p>
          </motion.div>
        )}

        {isMobile ? (
          <button
            type="button"
            onClick={onMobileClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-white/5 p-2 text-[#94A3B8] backdrop-blur-sm transition hover:bg-[#102544] hover:text-[#E5E7EB]"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" strokeWidth={ICON_STROKE} />
          </button>
        ) : (
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleCollapse}
            className={cn(
              "absolute rounded-lg border border-white/10 bg-white/[0.04] p-2 text-[#94A3B8] backdrop-blur-md transition hover:bg-[#102544] hover:text-[#E5E7EB]",
              !showLabels ? "bottom-2 right-1/2 translate-x-1/2" : "right-3 top-1/2 -translate-y-1/2",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft
              className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")}
              strokeWidth={ICON_STROKE}
            />
          </motion.button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        {visibleGroups.map((group, groupIndex) => (
          <motion.div
            key={group.title}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: groupIndex * 0.03, duration: 0.25 }}
            className={cn("sidebar-nav-group", groupIndex === 0 && "pt-0")}
          >
            {showLabels && (
              <button
                type="button"
                onClick={() =>
                  setCollapsedGroups((g) => ({ ...g, [group.title]: !g[group.title] }))
                }
                className="mb-2 flex w-full items-center justify-between rounded-lg px-3 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]/90 transition hover:bg-white/[0.04] hover:text-[#E5E7EB]"
                aria-expanded={!collapsedGroups[group.title]}
              >
                {group.title}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    collapsedGroups[group.title] && "-rotate-90",
                  )}
                  strokeWidth={ICON_STROKE}
                />
              </button>
            )}
            {!collapsedGroups[group.title] && (
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon }) => {
                const active = href === activeHref;
                const badge = sidebarBadgeForHref(href, sidebarBadges);

                return (
                  <li key={`${group.title}-${label}`}>
                    <SidebarNavLink
                      href={href}
                      label={label}
                      icon={icon}
                      active={active}
                      collapsed={!showLabels}
                      badge={badge}
                      onNavigate={isMobile ? onMobileClose : undefined}
                    />
                  </li>
                );
              })}
            </ul>
            )}
          </motion.div>
        ))}
      </nav>

      <SidebarUserFooter user={user} collapsed={!showLabels} />
    </motion.aside>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-[#071226]/80 backdrop-blur-sm"
              onClick={onMobileClose}
              aria-label="Close navigation overlay"
            />
            <motion.div
              initial={{ x: -SIDEBAR_EXPANDED }}
              animate={{ x: 0 }}
              exit={{ x: -SIDEBAR_EXPANDED }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="fixed inset-y-0 left-0 z-50"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return sidebarContent;
}
