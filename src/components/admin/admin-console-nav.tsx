import {
  Activity,
  Building2,
  KeyRound,
  Plug,
  Settings,
  UserCog,
} from "lucide-react";
import { ModuleNav, type ModuleNavLink } from "@/components/layout/module-nav";

const links: ModuleNavLink[] = [
  { href: "/admin", label: "Console", icon: Settings, exact: true },
  { href: "/users", label: "Users", icon: UserCog },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/company", label: "Company", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
];

export function AdminConsoleNav() {
  return <ModuleNav links={links} />;
}
