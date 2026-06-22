import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../utils/cn";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={loading || disabled}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none cursor-pointer active:scale-95 active:opacity-90 touch-none select-none",
          {
            "bg-primary-blue text-white hover:bg-blue-600": variant === "primary",
            "bg-primary-purple text-white hover:bg-purple-600": variant === "secondary",
            "border border-border bg-transparent hover:bg-card text-text-primary": variant === "outline",
            "bg-transparent hover:bg-card text-text-primary": variant === "ghost",
            "h-9 px-4 text-sm sm:h-10 sm:px-5": size === "sm",
            "h-10 px-4 py-2 sm:h-11 sm:px-6": size === "md",
            "h-11 px-8 text-lg sm:h-12 sm:px-10": size === "lg",
            "h-9 w-9 p-0 sm:h-10 sm:w-10": size === "icon",
          },
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
