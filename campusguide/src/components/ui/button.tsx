import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary/90 focus-visible:ring-primary/40 shadow-sm",
  secondary:
    "bg-secondary text-white hover:bg-secondary/90 focus-visible:ring-secondary/40 shadow-sm",
  ghost:
    "bg-transparent hover:bg-panel/60 text-foreground focus-visible:ring-accent/40",
  danger:
    "bg-risk text-white hover:bg-risk/90 focus-visible:ring-risk/40 shadow-sm",
};

export function Button({ className, variant = "primary", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-4 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
