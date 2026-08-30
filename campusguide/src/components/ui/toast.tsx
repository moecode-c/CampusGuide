"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A toast whose message comes in as a prop, not from client state.
 *
 * This is the fourth shape it took, and the reason matters. A global provider
 * with React state, then the same with a module-level store, then local state in
 * the page — all three lost the message. Instrumentation showed the login page
 * rendering with the right `next` param but its state stuck at null: something in
 * that subtree resets client state after mount, so anything *raised* by an effect
 * was gone before it could paint.
 *
 * Driving it from a prop the server already knows sidesteps that entirely. The
 * message is in the HTML on first paint, so it survives a remount — a remount
 * simply renders it again. Only dismissal is client state, and losing that just
 * means the notice stays up a little longer, which is the harmless direction.
 */

export type ToastTone = "info" | "success" | "error";

const TONE_STYLES: Record<ToastTone, { icon: React.ReactNode; ring: string }> = {
  info: { icon: <Info className="h-5 w-5 text-primary" />, ring: "border-primary/30" },
  success: { icon: <CheckCircle2 className="h-5 w-5 text-success" />, ring: "border-success/30" },
  error: { icon: <AlertCircle className="h-5 w-5 text-risk" />, ring: "border-risk/30" },
};

const DEFAULT_DURATION = 6000;

export function Toast({
  message,
  tone = "info",
  duration = DEFAULT_DURATION,
}: {
  message: string;
  tone?: ToastTone;
  /** Milliseconds before it fades itself out. 0 keeps it until dismissed. */
  duration?: number;
}) {
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(() => setDismissed(true), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  if (dismissed || !message) return null;

  return (
    <div
      // polite, not assertive: this announces a page-level notice, it does not
      // interrupt whatever the reader is in the middle of.
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed z-[100] flex flex-col gap-2",
        // Bottom-centre on a phone, where thumbs are; top-right on a laptop,
        // clear of the navbar.
        "inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
        "sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-20 sm:w-[22rem]"
      )}
    >
      <div
        role="status"
        className={cn(
          "pointer-events-auto flex items-start gap-3 rounded-2xl border bg-panel p-4 shadow-xl",
          "animate-toast-in",
          TONE_STYLES[tone].ring
        )}
      >
        <span className="mt-0.5 shrink-0">{TONE_STYLES[tone].icon}</span>
        <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">{message}</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 shrink-0 rounded-lg p-1 text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
