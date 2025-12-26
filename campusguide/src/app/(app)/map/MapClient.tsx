"use client";

import * as React from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, Navigation } from "lucide-react";
import Papa from "papaparse";

type Room = { roomCode: string; building: string; floor: number; x: number; y: number };

type Upcoming = { title: string; type: string; start: string; end: string; roomCode: string };

type ImportRow = {
  title: string;
  type: "lecture" | "lab";
  dayOfWeek: "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
  startTime: string;
  endTime: string;
  roomCode?: string;
};

export function MapClient() {
  const search = useSearchParams();
  const initialRoom = (search.get("room") ?? "").trim().toUpperCase();

  // Base pixel size for the map image. UI further constrains width responsively.
  const MAP_SIZE = 600;

  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [upcoming, setUpcoming] = React.useState<Upcoming[]>([]);
  const [scheduleRoomCodes, setScheduleRoomCodes] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Room | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [importMsg, setImportMsg] = React.useState<string | null>(null);
  const [mapImgError, setMapImgError] = React.useState(false);

  const transformRef = React.useRef<ReactZoomPanPinchRef | null>(null);

  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });
  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setViewportSize({ w: Math.max(0, r.width), h: Math.max(0, r.height) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setViewportSize({ w: Math.max(0, r.width), h: Math.max(0, r.height) });
    return () => ro.disconnect();
  }, []);

  const mapImageRef = React.useRef<HTMLDivElement | null>(null);

  const zoomToSelected = React.useCallback(
    (room: Room, scale = 3) => {
      const fn = transformRef.current?.setTransform;
      if (!fn) return;
      const vw = viewportSize.w;
      const vh = viewportSize.h;
      if (!vw || !vh) return;

      // Use actual rendered size if available, fallback to default
      const currentMapSize = mapImageRef.current?.getBoundingClientRect().width ?? MAP_SIZE;

      const x = vw / 2 - room.x * currentMapSize * scale;
      const y = vh / 2 - room.y * currentMapSize * scale;
      fn(x, y, scale);
    },
    [MAP_SIZE, viewportSize.h, viewportSize.w]
  );

  // React.useEffect(() => {
  //   if (!selected) return;
  //   // Auto-center disabled per user request
  //   // zoomToSelected(selected, 3);
  // }, [selected, zoomToSelected]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/student/map", { cache: "no-store" });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setError(j?.error ?? "Failed to load map data");
      setLoading(false);
      return;
    }
    const list = (j?.rooms ?? []) as Room[];
    setRooms(list);
    setUpcoming((j?.upcoming ?? []) as Upcoming[]);
    setScheduleRoomCodes(((j?.scheduleRoomCodes ?? []) as string[]).map((c) => String(c).trim().toUpperCase()));

    if (initialRoom) {
      const found = list.find((r) => r.roomCode === initialRoom);
      setSelected(found ?? null);
    }

    setError(null);
    setLoading(false);
  }, [initialRoom]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const results = React.useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [] as Room[];
    return rooms
      .filter((r) => r.roomCode.includes(q) || r.building.includes(q))
      .slice(0, 20);
  }, [query, rooms]);

  const upcomingRooms = React.useMemo(() => {
    const set = new Set(
      (scheduleRoomCodes.length ? scheduleRoomCodes : upcoming.map((e) => e.roomCode))
        .map((c) => String(c ?? "").trim().toUpperCase())
        .filter(Boolean)
    );
    return rooms.filter((r) => set.has(r.roomCode));
  }, [upcoming, rooms, scheduleRoomCodes]);

  async function onImportCsv(file: File) {
    setImportMsg(null);
    setImporting(true);

    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    if (parsed.errors?.length) {
      setImportMsg("CSV parse failed. Check the header row.");
      setImporting(false);
      return;
    }

    const allowedDow = new Set<ImportRow["dayOfWeek"]>(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);

    const rows: ImportRow[] = (parsed.data ?? [])
      .map((r) => {
        const title = String(r.title ?? "").trim();

        const typeRaw = String(r.type ?? "").trim().toLowerCase();
        const type: ImportRow["type"] = typeRaw.startsWith("lab") ? "lab" : "lecture";

        const dayOfWeekRaw = String(r.dayOfWeek ?? "").trim().toUpperCase();
        const dayOfWeek = (allowedDow.has(dayOfWeekRaw as any) ? dayOfWeekRaw : "MO") as ImportRow["dayOfWeek"];

        const startTime = String(r.startTime ?? "").trim();
        const endTime = String(r.endTime ?? "").trim();
        const roomCode = String(r.roomCode ?? "").trim();

        return {
          title,
          type,
          dayOfWeek,
          startTime,
          endTime,
          roomCode: roomCode ? roomCode : undefined,
        };
      })
      .filter((r) => Boolean(r.title));

    const res = await fetch("/api/student/schedule/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setImportMsg(j?.error ?? "Import failed");
      setImporting(false);
      return;
    }

    setImportMsg(`Imported ${j?.imported ?? rows.length} items into your calendar.`);
    await reload();
    setImporting(false);
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Campus Map</h1>
      <p className="text-sm text-foreground/70">Search rooms by code or building. Click to zoom and highlight.</p>

      <div className="grid gap-6 pt-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Find a room
            </CardTitle>
            <CardDescription>Room coordinates are image-based (not GPS).</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-foreground/70">Loading…</p>
            ) : error ? (
              <p className="text-sm font-semibold text-risk">{error}</p>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: C204 or building C" />
                  <Button type="button" variant="secondary" onClick={() => setQuery("")}>Clear</Button>
                </div>

                {selected ? (
                  <div className="rounded-2xl bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold">{selected.roomCode}</p>
                        <p className="text-xs text-foreground/70">Building {selected.building} • Floor {selected.floor}</p>
                      </div>
                      <Badge tone="neutral">Selected</Badge>
                    </div>
                    <p className="mt-3 text-xs text-foreground/70">Tip: Calendar events include a room field and a “Find room on map” link.</p>
                  </div>
                ) : (
                  <p className="text-sm text-foreground/70">Select a room to see details.</p>
                )}

                {results.length ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground/70">Results</p>
                    {results.map((r) => (
                      <button
                        key={r.roomCode}
                        className="flex w-full items-center justify-between rounded-2xl bg-panel px-4 py-3 text-left transition hover:bg-panel/80"
                        onClick={() => setSelected(r)}
                      >
                        <span className="font-extrabold">{r.roomCode}</span>
                        <span className="text-xs text-foreground/70">{r.building} • Floor {r.floor}</span>
                      </button>
                    ))}
                  </div>
                ) : query.trim() ? (
                  <p className="text-sm text-foreground/70">No matches.</p>
                ) : null}

                <div className="rounded-2xl border border-foreground/10 bg-background p-4">
                  <p className="text-sm font-extrabold">Your schedule on the map</p>
                  <p className="text-xs text-foreground/70">Upcoming lectures/labs (next 7 days) with a room code.</p>

                  <div className="mt-3 rounded-2xl bg-panel p-3">
                    <p className="text-xs font-semibold">Upload schedule CSV</p>
                    <p className="mt-1 text-xs text-foreground/70">
                      Headers: title,type,dayOfWeek,startTime,endTime,roomCode (type = lecture/lab, dayOfWeek = MO..SU, time = HH:mm).
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".csv,text/csv"
                        disabled={importing}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onImportCsv(f);
                          e.currentTarget.value = "";
                        }}
                      />
                      <Button type="button" variant="secondary" disabled={importing} onClick={() => setImportMsg(null)}>
                        Clear
                      </Button>
                    </div>
                    {importMsg ? <p className="mt-2 text-xs font-semibold text-foreground/80">{importMsg}</p> : null}
                  </div>

                  <div className="mt-3 space-y-2">
                    {upcoming.length === 0 ? (
                      <p className="text-sm text-foreground/70">Add room codes to your calendar events to see them here.</p>
                    ) : (
                      upcoming.slice(0, 6).map((e, idx) => (
                        <button
                          key={idx}
                          className="flex w-full items-center justify-between rounded-xl bg-panel px-3 py-2 text-left hover:bg-panel/80"
                          onClick={() => setSelected(rooms.find((r) => r.roomCode === e.roomCode) ?? null)}
                        >
                          <span className="truncate text-sm font-semibold">{e.title}</span>
                          <span className="text-xs font-extrabold text-primary">{e.roomCode}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Interactive map
            </CardTitle>
            <CardDescription>
              Use pinch/scroll to zoom. Searching a room centers the marker. The map image must exist at /public/campus-map.png.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              ref={viewportRef}
              className="mx-auto w-full max-w-150 overflow-hidden rounded-2xl border border-foreground/10 bg-background"
            >
              <TransformWrapper
                ref={transformRef}
                initialScale={selected ? 2 : 1}
                minScale={1}
                maxScale={6}
                centerOnInit
                wheel={{ step: 0.15 }}
                doubleClick={{ disabled: true }}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    <div className="flex flex-wrap items-center gap-2 border-b border-foreground/10 p-3">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => (transformRef.current?.zoomIn ? transformRef.current.zoomIn() : zoomIn())}
                      >
                        +
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => (transformRef.current?.zoomOut ? transformRef.current.zoomOut() : zoomOut())}
                      >
                        −
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => (transformRef.current?.resetTransform ? transformRef.current.resetTransform() : resetTransform())}
                      >
                        Reset
                      </Button>
                    </div>

                    <TransformComponent
                      wrapperStyle={{ width: "100%", height: "100%" }}
                      contentStyle={{ width: "100%" }}
                    >
                      <div ref={mapImageRef} className="relative w-full aspect-square bg-muted/20">
                        {!mapImgError ? (
                          <Image
                            src="/campus-map.png"
                            alt="Campus map"
                            fill
                            priority
                            onError={() => setMapImgError(true)}
                            className="object-contain select-none"
                            sizes="(max-width: 768px) 100vw, 600px"
                          />
                        ) : (
                          <div className="grid aspect-square w-full place-items-center bg-panel p-8 text-center">
                            <div>
                              <p className="text-sm font-extrabold">Map image not found</p>
                              <p className="mt-1 text-xs text-foreground/70">
                                Add your campus map image at <span className="font-semibold">public/campus-map.png</span>.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Schedule markers */}
                        {upcomingRooms.map((r) => (
                          <div
                            key={`up-${r.roomCode}`}
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%` }}
                          >
                            <button
                              type="button"
                              onClick={() => setSelected(r)}
                              className="h-4 w-4 rounded-full bg-secondary shadow-sm ring-4 ring-secondary/30"
                              title={`Scheduled: ${r.roomCode}`}
                              aria-label={`Select ${r.roomCode}`}
                            />
                          </div>
                        ))}

                        {/* Selected marker (Absolute positioned wrapper with zero size to prevent offset) */}
                        {selected ? (
                          <div
                            className="absolute z-10"
                            style={{ left: `${selected.x * 100}%`, top: `${selected.y * 100}%` }}
                          >
                            <div className="relative flex flex-col items-center">
                              {/* The pin visual - centered on the coordinate */}
                              <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2">
                                <span className="flex h-5 w-5 rounded-full bg-primary shadow-sm ring-4 ring-primary/30" />
                                <span className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/60" />
                              </div>

                              {/* Tooltip - positioned below the pin */}
                              <div className="absolute top-4 flex w-max max-w-[200px] flex-col items-center">
                                <div className="mt-2 rounded-xl bg-nav px-3 py-2 text-xs font-semibold text-white shadow-lg">
                                  {selected.roomCode} • {selected.building} • Floor {selected.floor}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
