import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "bg-gold-500/20 text-gold-600 dark:text-gold-400",
        success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        warning: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
        danger: "bg-red-500/15 text-red-700 dark:text-red-400",
        muted: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
