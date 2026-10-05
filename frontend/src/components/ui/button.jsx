import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[6px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3ecf8e] disabled:pointer-events-none disabled:opacity-40 cursor-pointer active:scale-[0.99]",
  {
    variants: {
      variant: {
        default: "bg-[#3ecf8e] text-[#171717] hover:bg-[#24b47e] active:bg-[#24b47e] shadow-xs",
        primary: "bg-[#3ecf8e] text-[#171717] hover:bg-[#24b47e] active:bg-[#24b47e] shadow-xs",
        outline: "bg-[#ffffff] text-[#171717] border border-[#dfdfdf] hover:border-[#c7c7c7] hover:bg-[#fafafa] dark:bg-[#18181b] dark:text-[#ededed] dark:border-[#27272a] dark:hover:border-[#3f3f46] dark:hover:bg-[#27272a]",
        secondary: "bg-[#fafafa] text-[#171717] border border-[#ededed] hover:bg-[#efefef] dark:bg-[#27272a] dark:text-[#ededed] dark:border-[#3f3f46] dark:hover:bg-[#3f3f46]",
        dark: "bg-[#1c1c1c] text-[#ffffff] hover:bg-[#282828] dark:bg-[#27272a] dark:hover:bg-[#3f3f46]",
        ghost: "text-[#707070] hover:text-[#171717] hover:bg-[#fafafa] dark:text-[#a1a1aa] dark:hover:text-[#ededed] dark:hover:bg-[#27272a]",
        destructive: "bg-[#ff2201]/10 text-[#ff2201] border border-[#ff2201]/20 hover:bg-[#ff2201]/15 dark:bg-[#ff2201]/20 dark:text-[#ff453a]",
        link: "text-[#171717] dark:text-[#ededed] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 text-sm",
        sm: "h-8 px-3 text-xs rounded-[6px]",
        lg: "h-10 px-5 text-sm rounded-[6px]",
        icon: "h-8 w-8 p-0 rounded-[6px] flex items-center justify-center",
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
