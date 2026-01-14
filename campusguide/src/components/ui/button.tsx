import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "default" | "sm" | "lg" | "icon";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
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
  outline:
    "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
};

const sizes: Record<Size, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-9 w-auto rounded-md px-3",
  lg: "h-11 rounded-md px-8",
  icon: "h-10 w-10",
};

export function Button({ className, variant = "primary", size = "default", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 active:translate-y-0 active:opacity-90",
        "focus-visible:outline-none focus-visible:ring-4 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
