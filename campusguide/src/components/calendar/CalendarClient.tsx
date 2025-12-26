"use client";

import * as React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import rrulePlugin from "@fullcalendar/rrule";
import { EventClickArg, EventDropArg, DateSelectArg } from "@fullcalendar/core";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus, MapPinned, Save, Trash2 } from "lucide-react";

type ApiEvent = {
  id: string;
  title: string;
  start?: string;
  end?: string;
  rrule?: any;
  duration?: any;
  exdate?: string[];
  extendedProps: {
    type: "lecture" | "lab" | "midterm" | "assignment";
    roomCode?: string | null;
    building?: string | null;
    isRecurring?: boolean;
  };
};

type Template = {
  startDate: string;
  endDate: string;
  excludedRanges: Array<{ start: string; end: string; label: string }>;
  maxAbsencePercent: number;
} | null;

function typeColor(type: ApiEvent["extendedProps"]["type"]) {
  switch (type) {
    case "lecture":
      return "bg-accent/30 border-accent/40";
    case "lab":
      return "bg-secondary/20 border-secondary/30";
    case "midterm":
      return "bg-primary/20 border-primary/30";
    case "assignment":
      return "bg-warning/20 border-warning/30";
  }
}

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CalendarClient() {
  const [events, setEvents] = React.useState<ApiEvent[]>([]);
  const [template, setTemplate] = React.useState<Template>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<ApiEvent | null>(null);

  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState<ApiEvent["extendedProps"]["type"]>("lecture");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [roomCode, setRoomCode] = React.useState("");
  const [recurring, setRecurring] = React.useState(false);
  const [byDay, setByDay] = React.useState<{ [k: string]: boolean }>({ MO: true, WE: false, SA: false, SU: false, TU: false, TH: false, FR: false });
  const [until, setUntil] = React.useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/student/events", { cache: "no-store" });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setError(j?.error ?? "Failed to load calendar");
      setLoading(false);
      return;
    }
    setEvents((j?.events ?? []) as ApiEvent[]);
    setTemplate((j?.template ?? null) as Template);
    setLoading(false);
  }

  React.useEffect(() => {
    load();
  }, []);

  function resetFormFromSelection(e: ApiEvent) {
    setTitle(e.title);
    setType(e.extendedProps.type);
    setRoomCode(e.extendedProps.roomCode ?? "");
    setRecurring(Boolean(e.extendedProps.isRecurring));
    const s = e.start ? new Date(e.start) : new Date();
    const en = e.end ? new Date(e.end) : new Date(s.getTime() + 60 * 60 * 1000);
    setStart(toDatetimeLocalValue(s));
    setEnd(toDatetimeLocalValue(en));
    setUntil("");
  }

  async function createEvent() {
    setError(null);
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = Object.entries(byDay)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(",");

    const rrule = recurring
      ? `FREQ=WEEKLY;BYDAY=${days}${until ? `;UNTIL=${new Date(until).toISOString().replace(/[-:]/g, "").split(".")[0]}Z` : ""}`
      : undefined;

    const res = await fetch("/api/student/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        type,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        roomCode: roomCode ? roomCode.trim().toUpperCase() : undefined,
        isRecurring: recurring,
        rrule,
      }),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error ?? "Create failed");
      return;
    }
    await load();
  }

  async function saveSelected() {
    if (!selected) return;
    setError(null);
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = Object.entries(byDay)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(",");

    const rrule = recurring
      ? `FREQ=WEEKLY;BYDAY=${days}${until ? `;UNTIL=${new Date(until).toISOString().replace(/[-:]/g, "").split(".")[0]}Z` : ""}`
      : undefined;

    const res = await fetch(`/api/student/events/${selected.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          roomCode: roomCode ? roomCode.trim().toUpperCase() : undefined,
          isRecurring: recurring,
          rrule,
        }),
      }
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error ?? "Save failed");
      return;
    }
    await load();
  }

  async function deleteSelected() {
    if (!selected) return;
    setError(null);
    const res = await fetch(`/api/student/events/${selected.id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error ?? "Delete failed");
      return;
    }
    setSelected(null);
    await load();
  }

  async function onDrop(arg: EventDropArg) {
    const id = arg.event.id;
    const start = arg.event.start;
    const end = arg.event.end;
    if (!start || !end) return;

    await fetch(`/api/student/events/${id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start: start.toISOString(), end: end.toISOString() }),
      }
    );
    // no-store reload
    await load();
  }

  function onSelect(info: DateSelectArg) {
    setSelected(null);
    setTitle("");
    setType("lecture");
    setRoomCode("");
    setRecurring(false);
    setStart(toDatetimeLocalValue(info.start));
    setEnd(toDatetimeLocalValue(info.end));
    setUntil("");
  }

  function onEventClick(arg: EventClickArg) {
    const id = arg.event.id;
    const found = events.find((e) => e.id === id);
    if (found) {
      setSelected(found);
      resetFormFromSelection(found);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Academic Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-foreground/70">Loading…</p>
          ) : (
            <div className="rounded-2xl bg-background p-2">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}
                initialView="timeGridWeek"
                headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
                selectable
                select={onSelect}
                editable
                eventDrop={onDrop}
                eventClick={onEventClick}
                height="auto"
                nowIndicator
                events={events as any}
              />
            </div>
          )}
          {template ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <Badge tone="neutral">Term: {new Date(template.startDate).toLocaleDateString()} → {new Date(template.endDate).toLocaleDateString()}</Badge>
              {(template.excludedRanges ?? []).map((r) => (
                <Badge key={r.label} tone="warning">
                  Excluded: {r.label}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-foreground/60">No semester template set for your academic year yet (admin must add it).</p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{selected ? "Edit event" : "Add event"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-semibold">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Physics Lecture" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold">Type</label>
              <Select value={type} onChange={(e) => setType(e.target.value as any)}>
                <option value="lecture">Lecture</option>
                <option value="lab">Lab</option>
                <option value="midterm">Midterm</option>
                <option value="assignment">Assignment</option>
              </Select>
              <div className={`mt-2 rounded-xl border p-2 text-xs font-semibold ${typeColor(type)}`}>Color-coded: {type}</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-semibold">Start</label>
                <Input value={start} onChange={(e) => setStart(e.target.value)} type="datetime-local" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold">End</label>
                <Input value={end} onChange={(e) => setEnd(e.target.value)} type="datetime-local" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold">Room (optional)</label>
              <Input value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="e.g. C204" />
              {roomCode ? (
                <Link
                  className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                  href={`/map?room=${encodeURIComponent(roomCode.trim().toUpperCase())}`}
                >
                  <MapPinned className="h-4 w-4" />
                  Find room on map
                </Link>
              ) : null}
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-background p-3">
              <label className="flex items-center justify-between gap-2 text-sm font-semibold">
                <span>Recurring (weekly)</span>
                <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
              </label>
              {recurring ? (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    {(["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const).map((d) => (
                      <label key={d} className="flex items-center gap-2 rounded-xl border border-foreground/10 bg-panel px-2 py-2 text-xs font-semibold">
                        <input
                          type="checkbox"
                          checked={Boolean(byDay[d])}
                          onChange={(e) => setByDay((p) => ({ ...p, [d]: e.target.checked }))}
                        />
                        {d}
                      </label>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold">Repeat until (optional)</label>
                    <Input value={until} onChange={(e) => setUntil(e.target.value)} type="date" />
                  </div>
                  <p className="text-xs text-foreground/70">Recurring lectures/labs automatically skip admin-defined excluded ranges.</p>
                </div>
              ) : null}
            </div>

            {error ? <p className="text-sm font-semibold text-risk">{error}</p> : null}

            <div className="flex flex-wrap gap-2 pt-1">
              {selected ? (
                <>
                  <Button type="button" variant="secondary" onClick={saveSelected}>
                    <Save className="h-4 w-4" /> Save
                  </Button>
                  <Button type="button" variant="danger" onClick={deleteSelected}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={createEvent}>
                  <CalendarPlus className="h-4 w-4" /> Add
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
