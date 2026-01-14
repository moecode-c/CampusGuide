"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ScheduleManager } from "@/components/calendar/ScheduleManager";
import { Button } from "@/components/ui/button";

const CalendarClient = dynamic(
  () => import("@/components/calendar/CalendarClient").then((m) => m.CalendarClient),
  { ssr: false, loading: () => <p className="text-sm text-foreground/70">Loading calendar…</p> }
);

export default function CalendarPage() {
  const [clearing, setClearing] = React.useState(false);

  function refetchCalendar() {
    window.dispatchEvent(new Event("cg:calendar:refetch"));
  }

  async function clearLectures() {
    if (!confirm("Clear all lectures from your calendar? This cannot be undone.")) return;
    setClearing(true);
    const res = await fetch("/api/student/events?type=lecture", { method: "DELETE" });
    setClearing(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Failed to clear lectures");
      return;
    }
    refetchCalendar();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Calendar</h1>
          <p className="text-sm text-foreground/70">Manage your weekly schedule.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button className="w-full sm:w-auto" variant="danger" disabled={clearing} onClick={clearLectures}>
            {clearing ? "Clearing…" : "Clear Lectures"}
          </Button>
          <ScheduleManager onUpdate={refetchCalendar} />
        </div>
      </div>

      <div className="pt-4">
        <CalendarClient />
      </div>
    </div>
  );
}
