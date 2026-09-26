import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs sm:text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-950/50",
        primary: "bg-blue-600 text-white hover:bg-blue-500 shadow-sm shadow-blue-950/50",
        destructive: "bg-rose-600 text-white hover:bg-rose-500 shadow-sm shadow-rose-950/50",
        outline: "border border-slate-800 bg-slate-950/60 text-slate-200 hover:bg-slate-800 hover:text-white",
        secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700/80",
        ghost: "hover:bg-slate-800/80 text-slate-300 hover:text-white",
        link: "text-emerald-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs rounded-md",
        lg: "h-11 px-6 text-sm sm:text-base rounded-xl",
        icon: "h-9 w-9 p-0 rounded-lg flex items-center justify-center",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
