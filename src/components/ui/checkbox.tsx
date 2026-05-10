import * as React from "react";
import { cn } from "@/lib/utils";

function Checkbox({ className, checked, onCheckedChange, ...props }: {
  className?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "checked">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 rounded-sm border border-[var(--primary)] cursor-pointer accent-[var(--primary)]",
        className
      )}
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  );
}

export { Checkbox };
