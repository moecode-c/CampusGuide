"use client";

import * as React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import rrulePlugin from "@fullcalendar/rrule";
import { Select } from "@/components/ui/select";
import { EventClickArg, EventDropArg } from "@fullcalendar/core";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { MapPinned, Trash2, Clock, MapPin, User, Loader2 } from "lucide-react";

type ApiEvent = {
  id: string;
  title: string;
  start?: string;
  end?: string;
  rrule?: any;
  extendedProps: {
    type: "lecture" | "lab";
    roomCode?: string | null;
    professor?: string | null;
    isRecurring?: boolean;
  };
};

export function CalendarClient() {
  const [events, setEvents] = React.useState<ApiEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<ApiEvent | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);

  const eventClassNames = React.useCallback((arg: any) => {
    const t = arg.event?.extendedProps?.type as ApiEvent["extendedProps"]["type"] | undefined;
    return t ? [`cg-event--${t}`] : [];
  }, []);

  const renderEventContent = React.useCallback((arg: any) => {
    const professor = arg.event.extendedProps?.professor as string | null | undefined;
    const roomCode = arg.event.extendedProps?.roomCode as string | null | undefined;
    const meta = [professor, roomCode].filter(Boolean).join(" • ");

    return (
      <div className="min-w-0">
        <div className="fc-event-time">{arg.timeText}</div>
        <div className="fc-event-title">{arg.event.title}</div>
        {meta ? <div className="text-[0.6rem] font-medium opacity-90 truncate">{meta}</div> : null}
      </div>
    );
  }, []);

  // Edit State
  const [editOpen, setEditOpen] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState("");
  const [editType, setEditType] = React.useState<"lecture" | "lab">("lecture");
  const [editStart, setEditStart] = React.useState("");
  const [editEnd, setEditEnd] = React.useState("");
  const [editRoom, setEditRoom] = React.useState("");
  const [editProf, setEditProf] = React.useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/student/events", { cache: "no-store" });
    const j = await res.json().catch(() => null);
    if (res.ok) {
      const raw = (j?.events ?? []) as any[];
      const filtered = raw.filter((e) => e?.extendedProps?.type === "lecture" || e?.extendedProps?.type === "lab");
      setEvents(filtered as ApiEvent[]);
    }
    setLoading(false);
  }

  React.useEffect(() => {
    load();
  }, []);

  // Handle Event Click -> Open Edit Modal
  function onEventClick(arg: EventClickArg) {
    const id = arg.event.id;
    const found = events.find((e) => e.id === id);
    if (found) {
      setSelected(found);
      setEditTitle(found.title);
      setEditType(found.extendedProps.type === "lab" ? "lab" : "lecture");

      // Parse start/end times - handle both string and rrule formats
      try {
        const startStr = typeof found.start === 'string' ? found.start : (found as any).rrule?.dtstart;
        const endStr = typeof found.end === 'string' ? found.end : null;

        if (startStr) {
          const d = new Date(startStr);
          if (!isNaN(d.getTime())) {
            const hours = d.getHours().toString().padStart(2, '0');
            const mins = d.getMinutes().toString().padStart(2, '0');
            setEditStart(`${hours}:${mins}`);
          } else {
            setEditStart("09:00");
          }
        } else {
          setEditStart("09:00");
        }

        if (endStr) {
          const d = new Date(endStr);
          if (!isNaN(d.getTime())) {
            const hours = d.getHours().toString().padStart(2, '0');
            const mins = d.getMinutes().toString().padStart(2, '0');
            setEditEnd(`${hours}:${mins}`);
          } else {
            setEditEnd("10:00");
          }
        } else if (startStr) {
          // Estimate end time as 1.5 hours after start
          const d = new Date(startStr);
          if (!isNaN(d.getTime())) {
            d.setMinutes(d.getMinutes() + 90);
            const hours = d.getHours().toString().padStart(2, '0');
            const mins = d.getMinutes().toString().padStart(2, '0');
            setEditEnd(`${hours}:${mins}`);
          } else {
            setEditEnd("10:00");
          }
        } else {
          setEditEnd("10:00");
        }
      } catch (err) {
        console.error("Error parsing event times:", err);
        setEditStart("09:00");
        setEditEnd("10:00");
      }

      setEditRoom(found.extendedProps.roomCode ?? "");
      setEditProf(found.extendedProps.professor ?? "");
      setEditOpen(true);
    }
  }

  // Handle Drag & Drop
  async function onDrop(arg: EventDropArg) {
    const id = arg.event.id;
    const start = arg.event.start;
    const end = arg.event.end;
    if (!start || !end) {
      // For rrule-based events, FullCalendar should provide an end via duration.
      // If it doesn't, avoid a silent no-op.
      console.warn("Missing start/end for dropped event", { id, start, end });
      return;
    }

    await fetch(`/api/student/events/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ start: start.toISOString(), end: end.toISOString() }),
    });
    // Silent reload
    load();
  }

  async function deleteEvent() {
    if (!selected) return;
    if (!confirm("Are you sure you want to delete this event? This will remove all occurrences if it's recurring.")) return;

    setIsBusy(true);
    await fetch(`/api/student/events/${selected.id}`, { method: "DELETE" });
    setIsBusy(false);
    setEditOpen(false);
    setSelected(null);
    load();
  }

  async function saveEventChanges() {
    if (!selected) return;
    setIsBusy(true);
    await fetch(`/api/student/events/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        type: editType,
        startTime: editStart,
        endTime: editEnd,
        roomCode: editRoom || undefined,
        professor: editProf || undefined,
      })
    });
    setIsBusy(false);
    setEditOpen(false);
    load();
  }

  return (
    <div className="w-full">
      <Card className="overflow-hidden ring-1 ring-primary/20 shadow-xl shadow-primary/10">
        <CardContent className="p-0">
          {loading ? (
        <div className="p-12 text-center text-foreground/70">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary/40" />
              <p>Loading schedule...</p>
            </div>
          ) : (
        <div className="p-4 bg-nav text-xs min-h-[650px] h-[75dvh]">
              <style jsx global>{`
                    .fc {
              --fc-border-color: color-mix(in srgb, var(--foreground) 16%, transparent);
              --fc-today-bg-color: color-mix(in srgb, var(--accent) 55%, transparent);
                    --fc-event-bg-color: var(--primary);
                    --fc-event-border-color: var(--secondary);
              --fc-page-bg-color: var(--nav);
                    }
                    .fc th {
                        padding: 12px 0;
                        font-weight: 600;
              color: color-mix(in srgb, var(--foreground) 65%, transparent);
              background: var(--nav);
                        text-transform: uppercase;
                        font-size: 0.7rem;
                        letter-spacing: 0.05em;
                    }
                    .fc-timegrid-slot-label {
                        font-size: 0.7rem;
              color: color-mix(in srgb, var(--foreground) 55%, transparent);
                        font-weight: 500;
                    }
                    .fc-event {
                        border-radius: 4px;
                        padding: 2px 4px;
                        font-size: 0.65rem;
                        font-weight: 600;
                        border: none;
                        cursor: pointer;
                        transition: all 0.2s;
                        line-height: 1.2;
                    }
                    .fc-event:hover {
                        transform: translateY(-1px);
              box-shadow: 0 6px 18px color-mix(in srgb, var(--primary) 35%, transparent);
                    }
                    .fc-v-event {
                      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
                      border-left: 3px solid var(--warning);
              color: var(--foreground);
              box-shadow: 0 2px 10px color-mix(in srgb, var(--primary) 25%, transparent);
                    }
                    .fc-h-event {
              background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
                        border: none;
              color: var(--foreground);
                    }

                    /* Type color-coding */
                    .fc .cg-event--lecture.fc-event,
                    .fc .cg-event--lecture.fc-v-event,
                    .fc .cg-event--lecture.fc-h-event {
                      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
                      box-shadow: 0 2px 12px color-mix(in srgb, var(--primary) 30%, transparent);
                    }
                    .fc .cg-event--lecture.fc-v-event { border-left-color: var(--warning); }

                    .fc .cg-event--lab.fc-event,
                    .fc .cg-event--lab.fc-v-event,
                    .fc .cg-event--lab.fc-h-event {
                      background: linear-gradient(135deg, var(--secondary) 0%, var(--accent) 100%);
                      box-shadow: 0 2px 12px color-mix(in srgb, var(--secondary) 28%, transparent);
                    }
                    .fc .cg-event--lab.fc-v-event { border-left-color: var(--primary); }
                    .fc-day-today {
              background-color: color-mix(in srgb, var(--accent) 60%, transparent) !important;
                    }
                    .fc-timegrid-now-indicator-line {
              border-color: var(--warning);
                        border-width: 2px;
                    }
                    .fc-timegrid-now-indicator-arrow {
              border-color: var(--warning);
                        border-width: 6px;
                    }
                    .fc-col-header-cell {
              background: var(--nav) !important;
                    }
                    .fc-timegrid-slot {
              border-color: color-mix(in srgb, var(--foreground) 16%, transparent) !important;
                    }
                    .fc-event-title {
                        font-weight: 600;
                        font-size: 0.65rem;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        line-height: 1.2;
                    }
                    .fc-event-time {
                        font-size: 0.6rem;
                        font-weight: 500;
                        opacity: 0.9;
                    }
                `}</style>
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}
                initialView="timeGridWeek"
                headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridWeek,timeGridDay" }}
                selectable={false}
                editable={true}
                eventClick={onEventClick}
                eventDrop={onDrop}
                height="100%"
                expandRows={true}
                slotMinTime="08:00:00"
                slotMaxTime="20:00:00"
                allDaySlot={false}
                nowIndicator
                eventContent={renderEventContent}
                eventClassNames={eventClassNames}
                events={events as any}
                dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Event Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[420px] bg-panel text-foreground border border-foreground/10 shadow-xl shadow-primary/10">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Class</DialogTitle>
            <DialogDescription className="text-foreground/70">Update class details below.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/80">Course Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-background/40 border-foreground/15 text-foreground placeholder:text-foreground/50 focus:ring-accent/40"
                placeholder="Course Name"
              />
            </div>

            {/* Type */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/80">Type</label>
              <Select
                value={editType}
                onChange={(e) => setEditType(e.target.value as "lecture" | "lab")}
                className="bg-background/40 border-foreground/15 text-foreground focus:ring-accent/40"
              >
                <option value="lecture">Lecture</option>
                <option value="lab">Lab</option>
              </Select>
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/80">Start Time</label>
                <Input
                  type="time"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="bg-background/40 border-foreground/15 text-foreground focus:ring-accent/40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/80">End Time</label>
                <Input
                  type="time"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="bg-background/40 border-foreground/15 text-foreground focus:ring-accent/40"
                />
              </div>
            </div>

            {/* Professor */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
                <User className="w-3 h-3" /> Professor
              </label>
              <Input
                value={editProf}
                onChange={(e) => setEditProf(e.target.value)}
                className="bg-background/40 border-foreground/15 text-foreground placeholder:text-foreground/50 focus:ring-accent/40"
                placeholder="Dr. Ahmed Hassan"
              />
            </div>

            {/* Location */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Location
              </label>
              <Input
                value={editRoom}
                onChange={(e) => setEditRoom(e.target.value)}
                className="bg-background/40 border-foreground/15 text-foreground placeholder:text-foreground/50 focus:ring-accent/40"
                placeholder="Room (e.g. RC1, 242)"
              />
              {editRoom && (
                <Link
                  href={`/map?room=${encodeURIComponent(editRoom)}`}
                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                >
                  <MapPinned className="w-3 h-3" /> View on Map
                </Link>
              )}
            </div>

            {selected?.extendedProps.isRecurring && (
              <p className="text-xs text-foreground/60 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Repeats Weekly
              </p>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:justify-between border-t border-foreground/10 pt-4 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={deleteEvent}
              disabled={isBusy}
              className="text-risk hover:bg-risk/10"
            >
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
            <Button
              size="sm"
              onClick={saveEventChanges}
              disabled={isBusy}
              className="shadow-lg shadow-primary/20"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
