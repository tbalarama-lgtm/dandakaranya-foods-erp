import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export function SelectField({
  label,
  name,
  required,
  defaultValue,
  children,
  className,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className={cn(
          "mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
        )}
      >
        {children}
      </select>
    </div>
  );
}
