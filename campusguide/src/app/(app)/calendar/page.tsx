"use client";

import dynamic from "next/dynamic";

const CalendarClient = dynamic(
  () => import("@/components/calendar/CalendarClient").then((m) => m.CalendarClient),
  { ssr: false, loading: () => <p className="text-sm text-foreground/70">Loading calendar…</p> }
);

export default function CalendarPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Calendar</h1>
      <p className="text-sm text-foreground/70">Month & week views with drag-and-drop and recurring lectures/labs.</p>
      <div className="pt-4">
        <CalendarClient />
      </div>
    </div>
  );
}
