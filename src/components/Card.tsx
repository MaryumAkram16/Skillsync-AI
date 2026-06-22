import { HTMLAttributes, forwardRef } from "react";
import { cn } from "../utils/cn";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-border bg-card text-text-primary shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";
