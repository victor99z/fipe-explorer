import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-xl border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 bg-[#FFFDFB] dark:bg-[#242226] px-3 py-1.5 text-sm text-[#2D2D2D] dark:text-[#F5F2F3] placeholder:text-[#2D2D2D]/45 dark:placeholder:text-[#F5F2F3]/45 transition-all duration-200 focus:border-[#2D2D2D] dark:focus:border-[#CBE4F0] focus:ring-2 focus:ring-[#CBE4F0] focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
