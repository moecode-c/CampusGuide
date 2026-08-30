"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/**
 * A password field with a reveal toggle.
 *
 * Typing a password blind is where most sign-in failures come from, especially
 * on a phone keyboard — being able to check it is worth more than hiding it
 * from someone who might be looking over your shoulder.
 *
 * The toggle is a real <button type="button">: inside a form, the default
 * submit type would post the form every time someone peeked at their password.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        // Room for the button so a long password never runs under it.
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // Announced as a state, not just a label, so a screen reader user knows
        // whether their password is currently on screen.
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        className={cn(
          "absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg",
          "text-foreground/55 transition-colors hover:bg-foreground/10 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        )}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
