import {
  ClipboardCheck,
  FlaskConical,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { ModuleNav, type ModuleNavLink } from "@/components/layout/module-nav";

const links: ModuleNavLink[] = [
  { href: "/quality", label: "Overview", icon: ShieldCheck, exact: true },
  { href: "/procurement/grn", label: "GRN QC", icon: ClipboardCheck },
  { href: "/production/quality", label: "Production QC", icon: FlaskConical },
  { href: "/production/batches", label: "Batch trace", icon: Layers },
];

export function QualityNav() {
  return <ModuleNav links={links} />;
}
