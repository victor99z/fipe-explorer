import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#27272a] text-[#171717] dark:text-[#ededed]",
        success: "border-[#3ecf8e]/30 bg-[#3ecf8e]/10 text-[#24b47e] dark:text-[#3ecf8e] font-medium",
        primary: "border-[#3ecf8e]/30 bg-[#3ecf8e]/10 text-[#24b47e] dark:text-[#3ecf8e] font-medium",
        brand: "border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] text-[#171717] dark:text-[#ededed]",
        secondary: "border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#27272a] text-[#707070] dark:text-[#a1a1aa]",
        outline: "border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] text-[#707070] dark:text-[#a1a1aa]",
        dark: "border-[#1c1c1c] dark:border-[#27272a] bg-[#1c1c1c] dark:bg-[#27272a] text-[#ffffff] dark:text-[#ededed]",
        destructive: "border-[#ff2201]/30 bg-[#ff2201]/10 text-[#c81e00] dark:text-[#ff453a]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
