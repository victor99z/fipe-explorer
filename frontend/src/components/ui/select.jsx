import * as React from "react"
import { cn } from "../../lib/utils"

const Select = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer",
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  )
})
Select.displayName = "Select"

export { Select }
