import { MapPin, Package, Route, Truck, Warehouse } from "lucide-react";
import { ModuleNav, type ModuleNavLink } from "@/components/layout/module-nav";

const links: ModuleNavLink[] = [
  { href: "/logistics", label: "Overview", icon: Truck, exact: true },
  { href: "/warehouses/dispatch", label: "Dispatch", icon: Package },
  { href: "/warehouses/transfers", label: "Transfers", icon: Route },
  { href: "/warehouses", label: "Warehouses", icon: Warehouse },
  { href: "/branches", label: "Branches", icon: MapPin },
];

export function LogisticsNav() {
  return <ModuleNav links={links} />;
}
