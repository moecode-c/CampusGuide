"use client";

import * as React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Select } from "@/components/ui/select";
import { EventClickArg } from "@fullcalendar/core";
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
  extendedProps: {
    type: "lecture" | "lab";
    roomCode?: string | null;
    professor?: string | null;
    isRecurring?: boolean;
    baseId?: string;
  };
};

export function CalendarClient() {
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<ApiEvent | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);
  const calendarRef = React.useRef<FullCalendar | null>(null);

  const [initialView, setInitialView] = React.useState<"timeGridWeek" | "timeGridDay">("timeGridWeek");

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setInitialView(mq.matches ? "timeGridDay" : "timeGridWeek");
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

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
  const [editDow, setEditDow] = React.useState<"SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA">("SA");
  const [editStart, setEditStart] = React.useState("");
  const [editEnd, setEditEnd] = React.useState("");
  const [editRoom, setEditRoom] = React.useState("");
  const [editProf, setEditProf] = React.useState("");

  function dowCodeFromDate(d: Date) {
    const map = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
    return (map[d.getDay()] ?? "MO") as typeof map[number];
  }

  function hhmm(d: Date) {
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  const refetch = React.useCallback(() => {
    calendarRef.current?.getApi().refetchEvents();
  }, []);

  React.useEffect(() => {
    const handler = () => refetch();
    window.addEventListener("cg:calendar:refetch", handler);
    return () => window.removeEventListener("cg:calendar:refetch", handler);
  }, [refetch]);

  const fetchEvents = React.useCallback(async (info: any, successCallback: any, failureCallback: any) => {
    try {
      const url = new URL("/api/student/events", window.location.origin);
      url.searchParams.set("start", info.startStr);
      url.searchParams.set("end", info.endStr);

      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: { "cache-control": "no-store" },
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error ?? "Failed to load schedule");

      const raw = (j?.events ?? []) as any[];
      const filtered = raw.filter((e) => e?.extendedProps?.type === "lecture" || e?.extendedProps?.type === "lab");
      successCallback(filtered);
    } catch (err) {
      failureCallback(err);
    }
  }, []);

  async function patchEvent(id: string, body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/student/events/${id}` as const, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        console.warn("Failed to update event", { id, status: res.status, error: j?.error });
        return { ok: false as const, error: (j?.error as string | undefined) ?? "Update failed" };
      }

      return { ok: true as const };
    } catch (err) {
      console.warn("Failed to update event (network)", { id, err });
      return { ok: false as const, error: "Network error" };
    }
  }

  // Handle Event Click -> Open Edit Modal
  function onEventClick(arg: EventClickArg) {
    const ext = (arg.event.extendedProps ?? {}) as any;
    const baseId = (ext.baseId as string | undefined) ?? arg.event.groupId ?? String(arg.event.id).split(":")[0];
    const fallback: ApiEvent = {
      id: baseId,
      title: arg.event.title,
      extendedProps: {
        type: (ext.type as any) === "lab" ? "lab" : "lecture",
        roomCode: (ext.roomCode as any) ?? null,
        professor: (ext.professor as any) ?? null,
        isRecurring: Boolean((ext.isRecurring as any) ?? false),
        baseId,
      },
    };

    setSelected(fallback);
    setEditTitle(fallback.title);
    setEditType(fallback.extendedProps.type === "lab" ? "lab" : "lecture");
    setEditRoom(fallback.extendedProps.roomCode ?? "");
    setEditProf(fallback.extendedProps.professor ?? "");

    // Always use the clicked occurrence's times (works for recurring + one-off)
    const start = arg.event.start ?? new Date();
    const end = arg.event.end ?? new Date(start.getTime() + 60 * 60 * 1000);
    setEditStart(hhmm(start));
    setEditEnd(hhmm(end));
    setEditDow(dowCodeFromDate(start));

    // Popup-only editing
    setEditOpen(true);
  }


  async function deleteEvent() {
    if (!selected) return;
    if (!confirm("Are you sure you want to delete this event? This will remove all occurrences if it's recurring.")) return;

    setIsBusy(true);
    try {
      const res = await fetch(`/api/student/events/${selected.id}`, { method: "DELETE" });
      if (!res.ok) {
        // Previously any failure was swallowed and the dialog closed as if it worked.
        const j = await res.json().catch(() => null);
        alert(j?.error ?? "Failed to delete this class.");
        return;
      }
      setEditOpen(false);
      setSelected(null);
      refetch();
    } catch {
      alert("Network error. The class was not deleted.");
    } finally {
      setIsBusy(false);
    }
  }

  async function saveEventChanges() {
    if (!selected) return;

    if (!editTitle.trim()) {
      alert("Course title is required.");
      return;
    }
    if (!editStart || !editEnd || editEnd <= editStart) {
      alert("End time must be after start time.");
      return;
    }

    setIsBusy(true);

    const result = await patchEvent(selected.id, {
      title: editTitle,
      type: editType,
      dayOfWeek: selected.extendedProps.isRecurring ? editDow : undefined,
      startTime: editStart,
      endTime: editEnd,
      // Send "" rather than dropping the key so a cleared field is actually cleared.
      roomCode: editRoom.trim(),
      professor: editProf.trim(),
    });

    setIsBusy(false);
    if (!result.ok) {
      alert(result.error);
      return;
    }

    setEditOpen(false);
    refetch();
  }

  return (
    <div className="w-full">
      <Card className="overflow-hidden ring-1 ring-primary/20 shadow-xl shadow-primary/10">
        <CardContent className="p-0">
          <div className="relative h-[62dvh] overflow-x-auto bg-nav p-2 text-xs sm:h-[75dvh] sm:p-4">
            {loading ? (
              <div className="absolute inset-0 z-10 grid place-items-center bg-nav/70 backdrop-blur-[1px]">
                <div className="text-center text-foreground/70">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary/40" />
                  <p>Loading schedule...</p>
                </div>
              </div>
            ) : null}

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
                ref={calendarRef as any}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                key={initialView}
                initialView={initialView}
                headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridWeek,timeGridDay" }}
                selectable={false}
                editable={false}
                eventStartEditable={false}
                eventDurationEditable={false}
                eventClick={onEventClick}
                height="100%"
                expandRows={true}
                slotMinTime="08:00:00"
                slotMaxTime="20:00:00"
                allDaySlot={false}
                nowIndicator
                eventContent={renderEventContent}
                eventClassNames={eventClassNames}
                events={fetchEvents as any}
                loading={(isLoading) => setLoading(isLoading)}
                dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
              />
          </div>
        </CardContent>
      </Card>

      {/* Full Event Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-panel text-foreground border border-foreground/10 shadow-xl shadow-primary/10 sm:max-w-lg">
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

            {/* Day (recurring only) */}
            {selected?.extendedProps.isRecurring ? (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/80">Day</label>
                <Select
                  value={editDow}
                  onChange={(e) => setEditDow(e.target.value as any)}
                  className="bg-background/40 border-foreground/15 text-foreground focus:ring-accent/40"
                >
                  <option value="SA">Saturday</option>
                  <option value="SU">Sunday</option>
                  <option value="MO">Monday</option>
                  <option value="TU">Tuesday</option>
                  <option value="WE">Wednesday</option>
                  <option value="TH">Thursday</option>
                  <option value="FR">Friday</option>
                </Select>
              </div>
            ) : null}

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
