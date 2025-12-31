"use client";

import Image from "next/image";
import Antigravity from "@/components/Antigravity";
import { useEffect, useRef, useState } from "react";

export function AboutHero() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [eventSource, setEventSource] = useState<HTMLElement | null>(null);
  const pointerRafRef = useRef<number | null>(null);
  const pointerPendingRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pointer, setPointer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    setEventSource(sectionRef.current);
  }, []);

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
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <Antigravity
          eventSource={eventSource}
          pointer={pointer}
          count={320}
          particleSize={1.9}
          waveAmplitude={1.35}
          waveSpeed={0.55}
          ringRadius={9}
          magnetRadius={9}
          rotationSpeed={0.15}
          depthFactor={1}
          color="#FF9FFC"
        />
      </div>
      <div className="absolute inset-0 bg-background/20" />

      <div className="relative grid min-h-65 grid-cols-1 gap-8 p-8 md:min-h-80 md:grid-cols-[1fr_auto] md:items-center md:p-10">
        <div className="space-y-2">
          <div className="text-base font-semibold text-foreground/70">About me</div>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Mohammed Essam El Din</h2>
          <p className="text-base text-foreground/70">
            Software Developer • (Placeholder bio — you’ll provide the final text later)
          </p>
          <div className="text-sm font-semibold text-foreground/60">
            Placeholder tags: Next.js • Full-stack • UI/UX • Databases
          </div>
        </div>

        <div className="h-36 w-36 overflow-hidden rounded-3xl border border-foreground/10 bg-background md:h-44 md:w-44">
          <Image src="/avatar-placeholder.svg" alt="Profile photo" width={256} height={256} className="h-full w-full object-cover" priority />
        </div>
      </div>
    </section>
  );
}
