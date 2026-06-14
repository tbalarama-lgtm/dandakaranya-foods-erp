"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModuleNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

export function ModuleNav({ links }: { links: ModuleNavLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card/80 p-1.5 shadow-erp backdrop-blur-md scrollbar-thin">
      {links.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[15px] font-medium transition-all duration-200 ease-out",
              active
                ? "bg-[#B68D40]/12 font-semibold text-[#E5E7EB] shadow-[inset_0_0_0_1px_rgba(182,141,64,0.2)] dark:text-[#E5E7EB]"
                : "text-muted-foreground hover:translate-x-0.5 hover:bg-[#102544]/10 hover:text-foreground dark:hover:bg-[#102544]",
            )}
          >
            {active && (
              <span className="absolute bottom-1.5 left-1.5 top-1.5 w-0.5 rounded-full bg-[#B68D40]" />
            )}
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
