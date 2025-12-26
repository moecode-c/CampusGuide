import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "success" | "warning" | "risk" | "neutral";

const toneClass: Record<Tone, string> = {
  success: "bg-success/15 text-success border-success/25",
  warning: "bg-warning/15 text-foreground border-warning/25",
  risk: "bg-risk/15 text-risk border-risk/25",
  neutral: "bg-accent/15 text-foreground border-foreground/10",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        toneClass[tone],
        className
      )}
      {...props}
    />
  );
}
