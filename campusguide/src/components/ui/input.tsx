import * as React from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full min-w-0 rounded-xl border border-foreground/15 bg-background px-3 text-base sm:text-sm",
        "placeholder:text-foreground/50 focus:outline-none focus:ring-4 focus:ring-accent/30",
        className
      )}
      {...props}
    />
  );
}
