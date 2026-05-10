import * as React from "react";
import { cn } from "@/lib/utils";

const Badge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
  }
>(({ className, variant = "default", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2",
      {
        "border-transparent bg-[var(--primary)] text-[var(--primary-foreground)]":
          variant === "default",
        "border-transparent bg-[var(--secondary)] text-[var(--secondary-foreground)]":
          variant === "secondary",
        "border-transparent bg-[var(--destructive)] text-white":
          variant === "destructive",
        "text-[var(--foreground)]": variant === "outline",
        "border-transparent bg-[var(--success)] text-white":
          variant === "success",
        "border-transparent bg-[var(--warning)] text-white":
          variant === "warning",
      },
      className
    )}
    {...props}
  />
));
Badge.displayName = "Badge";

export { Badge };
