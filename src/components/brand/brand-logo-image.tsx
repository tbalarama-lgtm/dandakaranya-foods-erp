import Image from "next/image";
import { BRAND_LOGO_LOCAL_SRC } from "@/lib/brand-logo";
import { cn } from "@/lib/utils";

type BrandLogoImageProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

/** Circular Dandakaranya brand mark — same format as website, invoices, and payslips. */
export function BrandLogoImage({ size = 40, className, priority }: BrandLogoImageProps) {
  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-full", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={BRAND_LOGO_LOCAL_SRC}
        alt="Dandakaranya Foods"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        priority={priority}
      />
    </div>
  );
}
