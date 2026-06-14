"use client";

import { cn } from "@/lib/utils";

export function DataTableShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("erp-table-shell overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function DataTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="erp-table-head border-b border-border/60 bg-muted/30 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </thead>
  );
}

export function DataTableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border/40">{children}</tbody>;
}

export function DataTableRow({
  children,
  className,
  interactive = true,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <tr className={cn(interactive && "erp-table-row", className)}>{children}</tr>
  );
}

export function DataTableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-5 py-3.5 align-middle", className)}>{children}</td>;
}

export function DataTableHeaderCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={cn("px-5 py-3.5 text-left font-semibold", className)}>{children}</th>
  );
}
