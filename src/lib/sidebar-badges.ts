export type SidebarBadges = {
  unreadNotifications: number;
  pendingPurchases: number;
  newLeads: number;
  pendingDocApprovals: number;
};

export const EMPTY_SIDEBAR_BADGES: SidebarBadges = {
  unreadNotifications: 0,
  pendingPurchases: 0,
  newLeads: 0,
  pendingDocApprovals: 0,
};

export function sidebarBadgeForHref(
  href: string,
  badges: SidebarBadges,
): "red" | "yellow" | "green" | null {
  if (href === "/") return "green";
  if (href === "/notifications" && badges.unreadNotifications > 0) return "red";
  if (href === "/leads" && badges.newLeads > 0) return "yellow";
  if (href === "/purchases/approvals" && badges.pendingPurchases > 0) return "red";
  if (href === "/documents" && badges.pendingDocApprovals > 0) return "red";
  if (href === "/documents/approvals" && badges.pendingDocApprovals > 0) return "red";
  return null;
}
