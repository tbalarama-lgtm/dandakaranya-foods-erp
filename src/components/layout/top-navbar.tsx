"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useTheme } from "@/components/providers/theme-provider";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Building2,
  ChevronDown,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  Menu,
} from "lucide-react";
import { GlobalSearchDialog } from "@/components/layout/global-search-dialog";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { roleLabel } from "@/lib/rbac";
import { ICON, ICON_STROKE } from "@/lib/enterprise-ui";
import type { UserRole } from "@prisma/client";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TopNavbar({
  user,
  unreadCount,
  showMenuButton = false,
  onMenuClick,
}: {
  user: { name: string; email: string; role: UserRole };
  unreadCount: number;
  showMenuButton?: boolean;
  onMenuClick?: () => void;
}) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && (theme === "dark" || resolvedTheme === "dark");

  return (
    <header className="erp-top-navbar sticky top-0 z-30 flex h-[4.25rem] shrink-0 items-center gap-3 px-4 lg:px-6">
      {showMenuButton && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-xl lg:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <Menu style={{ width: ICON.lg, height: ICON.lg }} strokeWidth={ICON_STROKE} />
        </Button>
      )}

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="erp-navbar-search group flex h-10 max-w-md flex-1 items-center gap-2.5 px-3.5 text-left text-sm"
      >
        <Search
          className="shrink-0 text-muted-foreground transition group-hover:text-[#B68D40]"
          style={{ width: ICON.sm, height: ICON.sm }}
          strokeWidth={ICON_STROKE}
        />
        <span className="truncate text-muted-foreground transition group-hover:text-foreground">
          Search invoices, products, customers…
        </span>
        <kbd className="ml-auto hidden rounded-md border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      <div className="flex items-center gap-1">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {mounted && isDark ? (
              <Sun style={{ width: ICON.md, height: ICON.md }} strokeWidth={ICON_STROKE} />
            ) : (
              <Moon style={{ width: ICON.md, height: ICON.md }} strokeWidth={ICON_STROKE} />
            )}
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <NotificationDropdown initialUnread={unreadCount} />
        </motion.div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="erp-navbar-profile-trigger flex items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-2.5"
            >
              <Avatar className="h-9 w-9 border border-[#B68D40]/25 shadow-sm">
                <AvatarFallback className="bg-gradient-to-br from-[#B68D40] to-[#967235] text-xs font-semibold text-[#071226]">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-left text-sm font-medium sm:inline">
                {user.name.split(" ")[0]}
              </span>
              <ChevronDown
                className="hidden text-muted-foreground sm:block"
                style={{ width: ICON.sm, height: ICON.sm }}
                strokeWidth={ICON_STROKE}
              />
            </motion.button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="pb-2">
              <p className="font-semibold tracking-tight">{user.name}</p>
              <p className="mt-0.5 text-xs font-normal text-muted-foreground">{user.email}</p>
              <span className="mt-2 inline-flex rounded-md border border-[#B68D40]/30 bg-[#B68D40]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#967235] dark:text-[#C9A55A]">
                {roleLabel(user.role)}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/company" className="cursor-pointer">
                <Building2 style={{ width: ICON.sm, height: ICON.sm }} strokeWidth={ICON_STROKE} />
                Company profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings style={{ width: ICON.sm, height: ICON.sm }} strokeWidth={ICON_STROKE} />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/notifications" className="cursor-pointer">
                <Bell style={{ width: ICON.sm, height: ICON.sm }} strokeWidth={ICON_STROKE} />
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-medium text-white">
                    {unreadCount}
                  </span>
                )}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-red-600 focus:bg-red-500/10 focus:text-red-600"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut style={{ width: ICON.sm, height: ICON.sm }} strokeWidth={ICON_STROKE} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
