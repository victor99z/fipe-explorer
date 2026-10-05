import * as React from "react"
import { cn } from "../../lib/utils"

const Select = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <select
      className={cn(
        "flex h-9 w-full rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] px-3 py-1.5 text-sm text-[#171717] dark:text-[#ededed] transition-colors focus:border-[#3ecf8e] dark:focus:border-[#3ecf8e] focus:ring-1 focus:ring-[#3ecf8e] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
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
