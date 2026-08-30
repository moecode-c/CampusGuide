"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export function AboutHero() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const pointerRafRef = useRef<number | null>(null);
  const pointerPendingRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pointer, setPointer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const roles = useRef([
    "FULL-STACK ENGINEER",
    "SOFTWARE DEVELOPER",
    "TUTOR-MENTOR-INSTRUCTOR",
    "RESEARCHER-PROBLEM SOLVER",
  ]);
  const [roleIndex, setRoleIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  const avatarStyle = {
    transform: `perspective(900px) rotateX(${pointer.y * 6}deg) rotateY(${pointer.x * 10}deg) translateZ(0)`,
  } as const;

  useEffect(() => {
    const current = roles.current[roleIndex] ?? "";
    const doneTyping = typed === current;
    const doneDeleting = typed.length === 0;

    const baseDelay = deleting ? 28 : 42;
    const jitter = Math.floor(Math.random() * 18);
    const delay = doneTyping ? 1100 : doneDeleting && deleting ? 220 : baseDelay + jitter;

    const t = window.setTimeout(() => {
      if (!deleting) {
        if (doneTyping) {
          setDeleting(true);
          return;
        }
        setTyped(current.slice(0, typed.length + 1));
        return;
      }

      if (doneDeleting) {
        setDeleting(false);
        setRoleIndex((i) => (i + 1) % roles.current.length);
        return;
      }
      setTyped((prev) => prev.slice(0, Math.max(0, prev.length - 1)));
    }, delay);

    return () => window.clearTimeout(t);
  }, [deleting, roleIndex, typed]);

  function updatePointer(next: { x: number; y: number }) {
    pointerPendingRef.current = next;
    if (pointerRafRef.current != null) return;
    pointerRafRef.current = window.requestAnimationFrame(() => {
      pointerRafRef.current = null;
      setPointer(pointerPendingRef.current);
    });
  }

  function onMove(e: React.PointerEvent<HTMLElement>) {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x01 = (e.clientX - rect.left) / rect.width;
    const y01 = (e.clientY - rect.top) / rect.height;

    const x = (x01 - 0.5) * 2;
    const y = -((y01 - 0.5) * 2);

    updatePointer({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
  }

  function onLeave() {
    updatePointer({ x: 0, y: 0 });
  }

  return (
    <section
      ref={sectionRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative overflow-hidden rounded-3xl border border-foreground/10 bg-panel/20"
    >
      {/* Replaces a three.js particle canvas that cost 229 KB gzipped on the two
          most-visited pages. Two static gradients read as the same ambient glow
          for no transferred bytes at all. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-45 md:opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 18% 25%, rgba(0,191,255,0.22), transparent 60%), radial-gradient(ellipse 55% 65% at 82% 78%, rgba(0,255,153,0.14), transparent 62%)",
        }}
      />
      <div className="absolute inset-0 bg-background/35 md:bg-background/20" />

      <div className="relative grid min-h-56 grid-cols-1 gap-5 p-4 md:min-h-80 md:grid-cols-[1fr_24rem] md:items-stretch md:gap-8 md:p-10 lg:min-h-96 lg:grid-cols-[1fr_30rem] lg:p-12">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-foreground/70 md:text-base">About me</div>
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl md:text-4xl lg:text-5xl">
            Mohammed Essam El Din
          </h2>
          <div className="inline-flex max-w-full min-w-0 items-center gap-2 text-[0.65rem] font-semibold tracking-[0.12em] text-primary/90 sm:text-xs sm:tracking-[0.18em] md:text-sm md:tracking-[0.22em]">
            <span className="min-w-0 truncate font-mono">{typed}</span>
            <span className="inline-block h-4 w-0.5 bg-primary/80 animate-pulse" aria-hidden />
          </div>
          <p className="text-base leading-relaxed text-foreground/80 md:text-lg">
            I’m the creator of CampusGuide, a platform built to help students navigate and simplify their campus life.
            As a full-stack software engineer, I designed CampusGuide to provide clear maps, essential resources, and
            practical tools that support students throughout their academic journey.
          </p>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <a href="https://moeportfoliov2.vercel.app" target="_blank" rel="noreferrer" className="inline-flex">
              <Button variant="secondary" className="h-10">
                <ExternalLink className="h-4 w-4" />
                Portfolio
              </Button>
            </a>
          </div>
        </div>

        <a
          href="https://moeportfoliov2.vercel.app"
          target="_blank"
          rel="noreferrer"
          aria-label="Open portfolio"
          className="group relative h-60 w-full justify-self-start overflow-hidden rounded-3xl border border-foreground/10 bg-background/40 transition-[border-color,box-shadow] duration-200 ease-out hover:border-foreground/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 md:h-full md:justify-self-end"
        >
          <div
            className="absolute inset-0"
            style={avatarStyle}
          >
            <div
              className="pointer-events-none absolute -inset-1 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, rgba(0,255,153,0.30), transparent 55%), radial-gradient(circle at 70% 70%, rgba(0,191,255,0.35), transparent 55%)",
              }}
            />
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: "radial-gradient(circle at 60% 40%, rgba(255,255,255,0.08), transparent 45%)" }} />
            <Image
              src="/retromo1nobg.png"
              alt="Retro character"
              fill
              sizes="(max-width: 768px) 92vw, 30rem"
              className="relative object-contain p-2 drop-shadow-[0_14px_55px_rgba(0,0,0,0.65)] transition-transform duration-300 ease-out group-hover:scale-[1.10] md:p-3"
              priority
            />
          </div>
        </a>
      </div>
    </section>
  );
}
