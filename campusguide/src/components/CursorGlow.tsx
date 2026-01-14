"use client";

import * as React from "react";

// Lightweight global cursor glow for a cyberpunk feel.
// Updates CSS variables on <html> so CSS can render a radial glow.
export function CursorGlow() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const isFinePointer = window.matchMedia?.("(pointer: fine)")?.matches;

    // Avoid on touch / reduced motion.
    if (prefersReduced || !isFinePointer) return;

    let raf: number | null = null;
    let lastX = 0;
    let lastY = 0;

    const onMove = (e: PointerEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (raf != null) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        // Use px for broad browser support.
        root.style.setProperty("--cursor-x", `${lastX}px`);
        root.style.setProperty("--cursor-y", `${lastY}px`);
        root.style.setProperty("--cursor-active", "1");
      });
    };

    const onLeave = () => {
      root.style.setProperty("--cursor-active", "0");
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("blur", onLeave);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      if (raf != null) window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("mouseleave", onLeave);
      root.style.removeProperty("--cursor-x");
      root.style.removeProperty("--cursor-y");
      root.style.removeProperty("--cursor-active");
    };
  }, []);

  return null;
}
