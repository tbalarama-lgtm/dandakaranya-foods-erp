"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNavbar } from "@/components/layout/top-navbar";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import type { SidebarBadges } from "@/lib/sidebar-badges";
import { EMPTY_SIDEBAR_BADGES } from "@/lib/sidebar-badges";
import type { UserRole } from "@prisma/client";

export function AppShell({
  children,
  user,
  sidebarBadges = EMPTY_SIDEBAR_BADGES,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; role: UserRole };
  sidebarBadges?: SidebarBadges;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="erp-desktop flex min-h-screen min-h-[100dvh] bg-[#071226] lg:min-w-[1200px]">
      <div className="hidden shrink-0 lg:block">
        <Sidebar
          user={user}
          collapsed={collapsed}
          sidebarBadges={sidebarBadges}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      </div>

      <div className="lg:hidden">
        <Sidebar
          user={user}
          collapsed={false}
          sidebarBadges={sidebarBadges}
          onToggleCollapse={() => undefined}
          isMobile
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar
          user={user}
          unreadCount={sidebarBadges.unreadNotifications}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 bg-[#F1F5F9] p-4 dark:bg-[#0B1424] lg:p-6 xl:p-8">
          <div className="erp-content-area">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
