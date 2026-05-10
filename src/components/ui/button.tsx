import * as React from "react";
import { cn } from "@/lib/utils";

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
  }
>(({ className, variant = "default", size = "default", ...props }, ref) => {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        {
          "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90":
            variant === "default",
          "bg-[var(--destructive)] text-white hover:bg-[var(--destructive)]/90":
            variant === "destructive",
          "border border-[var(--input)] bg-transparent hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]":
            variant === "outline",
          "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--secondary)]/80":
            variant === "secondary",
          "hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]":
            variant === "ghost",
          "text-[var(--primary)] underline-offset-4 hover:underline":
            variant === "link",
        },
        {
          "h-9 px-4 py-2": size === "default",
          "h-8 rounded-md px-3 text-xs": size === "sm",
          "h-10 rounded-md px-8": size === "lg",
          "h-9 w-9": size === "icon",
        },
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button };
