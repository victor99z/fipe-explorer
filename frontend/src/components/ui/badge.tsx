import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-xl border px-2.5 py-0.5 text-xs font-medium transition-colors duration-200 focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-[#2D2D2D]/15 bg-[#E6E6FA]/75 text-[#2D2D2D] dark:border-[#F5F2F3]/15 dark:bg-[#3B3948] dark:text-[#F5F2F3]",
        success: "border-[#2D2D2D]/15 bg-[#D0F0C0] text-[#2D2D2D] font-semibold",
        primary: "border-[#2D2D2D]/15 bg-[#CBE4F0] text-[#2D2D2D] font-semibold",
        brand: "border-[#2D2D2D]/15 bg-[#FFFDFB] text-[#2D2D2D] dark:bg-[#2D2D2D] dark:text-[#F5F2F3] dark:border-[#F5F2F3]/15",
        secondary: "border-[#2D2D2D]/15 bg-[#FAF6F7] text-[#2D2D2D]/80 dark:bg-[#242226] dark:text-[#F5F2F3]/80 dark:border-[#F5F2F3]/15",
        outline: "border-[#2D2D2D]/20 bg-[#FFFDFB] text-[#2D2D2D]/80 dark:bg-[#2D2D2D] dark:text-[#F5F2F3]/80 dark:border-[#F5F2F3]/20",
        dark: "border-[#2D2D2D] bg-[#2D2D2D] text-[#FFFDFB]",
        destructive: "border-[#2D2D2D]/20 bg-[#F6D0D6] text-[#2D2D2D] font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
