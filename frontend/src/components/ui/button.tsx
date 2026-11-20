import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CBE4F0] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 cursor-pointer active:-translate-y-[1px]",
  {
    variants: {
      variant: {
        default:
          "bg-[#CBE4F0] text-[#2D2D2D] border border-[#2D2D2D]/15 hover:bg-[#b5d7e8] shadow-[0_2px_10px_rgba(45,45,45,0.08)]",
        primary:
          "bg-[#CBE4F0] text-[#2D2D2D] border border-[#2D2D2D]/15 hover:bg-[#b5d7e8] shadow-[0_2px_10px_rgba(45,45,45,0.08)]",
        outline:
          "border-[1.5px] border-[#2D2D2D]/20 bg-[#FFFDFB] text-[#2D2D2D] hover:bg-[#F6D0D6]/35 dark:bg-[#2D2D2D] dark:text-[#F5F2F3] dark:border-[#F5F2F3]/20 dark:hover:bg-[#3B3948]",
        secondary:
          "border-[1.5px] border-[#2D2D2D]/15 bg-[#E6E6FA]/65 text-[#2D2D2D] hover:bg-[#E6E6FA] dark:bg-[#3B3948] dark:text-[#F5F2F3] dark:border-[#F5F2F3]/15 dark:hover:bg-[#494659]",
        dark:
          "bg-[#2D2D2D] text-[#FFFDFB] border border-[#2D2D2D] hover:bg-[#3c3c3c] dark:bg-[#CBE4F0] dark:text-[#2D2D2D] dark:hover:bg-[#b5d7e8]",
        ghost:
          "text-[#2D2D2D]/75 hover:text-[#2D2D2D] hover:bg-[#F6D0D6]/30 dark:text-[#F5F2F3]/75 dark:hover:text-[#F5F2F3] dark:hover:bg-[#3B3948]",
        destructive:
          "bg-[#F6D0D6]/85 text-[#2D2D2D] border border-[#2D2D2D]/20 hover:bg-[#F6D0D6] dark:bg-[#594448] dark:text-[#F5F2F3]",
        link: "text-[#2D2D2D] dark:text-[#F5F2F3] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 text-sm",
        sm: "h-8 px-3 text-xs rounded-xl",
        lg: "h-10 px-5 text-sm rounded-xl",
        icon: "h-8 w-8 p-0 rounded-xl flex items-center justify-center",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
