import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700",
        brand: "border-blue-500/30 bg-blue-500/10 text-blue-400 font-bold",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold",
        secondary: "border-transparent bg-slate-800/80 text-slate-300 hover:bg-slate-800",
        destructive: "border-rose-500/30 bg-rose-500/10 text-rose-400 font-bold",
        outline: "border-slate-800 text-slate-300",
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
