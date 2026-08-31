"use client";

import * as React from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Trash2 } from "lucide-react";

type Room = {
  _id: string;
  roomCode: string;
  building: string;
  floor: number;
  x: number;
  y: number;
};

export default function AdminRoomsPage() {
  const [items, setItems] = React.useState<Room[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [mapImgError, setMapImgError] = React.useState(false);
  const [mapSrc, setMapSrc] = React.useState("/campus-map-v3.png");
  const mapRef = React.useRef<HTMLDivElement | null>(null);

  const [listQuery, setListQuery] = React.useState("");
  const [listBuilding, setListBuilding] = React.useState("");
  const [listFloor, setListFloor] = React.useState("");

  const [roomCode, setRoomCode] = React.useState("");
  const [building, setBuilding] = React.useState("");
  const [floor, setFloor] = React.useState("1");
  const [x, setX] = React.useState("0.5");
  const [y, setY] = React.useState("0.5");

  function resetForm() {
    setEditingId(null);
    setRoomCode("");
    setBuilding("");
    setFloor("1");
    setX("0.5");
    setY("0.5");
  }

  function clamp01(n: number) {
    return Math.max(0, Math.min(1, n));
  }

  function onPickFromMap(e: React.MouseEvent) {
    const el = mapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const px = clamp01((e.clientX - r.left) / r.width);
    const py = clamp01((e.clientY - r.top) / r.height);
    setX(px.toFixed(3));
    setY(py.toFixed(3));
  }

  async function load() {
    setLoading(true);
    try {
      // "no-cache" revalidates instead of reading the browser cache. The route
      // sends max-age=10, so a reload right after create/edit/delete would
      // otherwise redisplay the pre-write list. The ETag still makes an
      // unchanged list a 304 with no body.
      const res = await fetch("/api/admin/rooms", { cache: "no-cache" });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Failed to load rooms");
        return;
      }
      setItems((j?.items ?? []) as Room[]);
      setError(null);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  const buildingOptions = React.useMemo(() => {
    const set = new Set(items.map((r) => String(r.building ?? "").trim().toUpperCase()).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  const floorOptions = React.useMemo(() => {
    const set = new Set(items.map((r) => r.floor).filter((n) => Number.isFinite(n)));
    return Array.from(set).sort((a, b) => a - b);
  }, [items]);

  const filteredItems = React.useMemo(() => {
    const q = listQuery.trim().toUpperCase();
    const b = listBuilding.trim().toUpperCase();
    const f = listFloor.trim();
    const floorNum = f ? Number(f) : null;

    return items.filter((r) => {
      const roomCode = String(r.roomCode ?? "").toUpperCase();
      const building = String(r.building ?? "").toUpperCase();
      const floorStr = String(r.floor ?? "");

      const matchesQuery = !q || roomCode.includes(q) || building.includes(q) || floorStr === q;
      const matchesBuilding = !b || building === b;
      const matchesFloor = floorNum == null || r.floor === floorNum;

      return matchesQuery && matchesBuilding && matchesFloor;
    });
  }, [items, listBuilding, listFloor, listQuery]);

  async function create() {
    setError(null);
    const floorNum = Number(floor);
    const xNum = Number(x);
    const yNum = Number(y);
    if (!Number.isFinite(floorNum) || !Number.isFinite(xNum) || !Number.isFinite(yNum)) {
      setError("Invalid numbers (floor/x/y).");
      return;
    }
    if (xNum < 0 || xNum > 1 || yNum < 0 || yNum > 1) {
      setError("x/y must be between 0 and 1.");
      return;
    }
    if (roomCode.trim().length < 2 || building.trim().length < 1) {
      setError("Room code (2+ chars) and building are required.");
      return;
    }

    try {
      const res = await fetch("/api/admin/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomCode,
          building,
          floor: floorNum,
          x: xNum,
          y: yNum,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Create failed");
        return;
      }
      resetForm();
      await load();
    } catch {
      setError("Network error. The room was not created.");
    }
  }

  async function saveEdit() {
    if (!editingId) return;
    setError(null);
    const floorNum = Number(floor);
    const xNum = Number(x);
    const yNum = Number(y);
    if (!Number.isFinite(floorNum) || !Number.isFinite(xNum) || !Number.isFinite(yNum)) {
      setError("Invalid numbers (floor/x/y).");
      return;
    }
    if (xNum < 0 || xNum > 1 || yNum < 0 || yNum > 1) {
      setError("x/y must be between 0 and 1.");
      return;
    }
    const payload = {
      roomCode,
      building,
      floor: floorNum,
      x: xNum,
      y: yNum,
    };

    try {
      const res = await fetch(`/api/admin/rooms/${editingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(j.error ?? "Save failed");
        return;
      }

      await load();
      resetForm();
    } catch {
      setError("Network error. Your changes were not saved.");
    }
  }

  async function del(id: string, code: string) {
    if (!confirm(`Delete room ${code}? This cannot be undone.`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/rooms/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Delete failed");
        return;
      }
      await load();
    } catch {
      setError("Network error. Nothing was deleted.");
    }
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Rooms</h1>
      <p className="text-sm text-foreground/70">Manage image coordinate rooms for the interactive campus map.</p>

      {/*
        Explicit track sizes, not fractions. A `grid-cols-4` column keeps
        shrinking as the screen grows in the other direction, which is how the
        form ended up at ~200px with its heading wrapped onto two lines and the
        map preview reduced to a thumbnail. A fixed 26rem column can't be
        starved, and `1fr` hands every remaining pixel to the list.
      */}
      {/* Side by side only from xl. A fixed 26rem column at lg left the list
          233px wide, which is worse than stacking. */}
      <div className="grid gap-6 pt-4 xl:grid-cols-[26rem_1fr] 2xl:grid-cols-[30rem_1fr]">
        <Card className="xl:sticky xl:top-6 xl:self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              {editingId ? "Edit room" : "Add room"}
            </CardTitle>
            <CardDescription>x/y are normalized coordinates (0..1).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-semibold">Room code</label>
                <Input value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="C204" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-sm font-semibold">Building</label>
                  <Input value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="C" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold">Floor</label>
                  <Input value={floor} onChange={(e) => setFloor(e.target.value)} type="number" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-sm font-semibold">x</label>
                  <Input value={x} onChange={(e) => setX(e.target.value)} type="number" step="0.001" min={0} max={1} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold">y</label>
                  <Input value={y} onChange={(e) => setY(e.target.value)} type="number" step="0.001" min={0} max={1} />
                </div>
              </div>

              <div className="rounded-2xl border border-foreground/10 bg-background p-4">
                <p className="text-sm font-semibold text-foreground/80">Pick coordinates on the map</p>
                <p className="mt-1 text-sm text-foreground/60">Click the map to set x/y for the current room.</p>
                <div
                  ref={mapRef}
                  className="relative mt-3 aspect-square w-full overflow-hidden rounded-2xl border border-foreground/10 bg-panel"
                  onClick={onPickFromMap}
                  role="button"
                  tabIndex={0}
                >
                  {!mapImgError ? (
                    <Image
                      src={mapSrc}
                      alt="Campus map"
                      fill
                      onError={() => {
                        if (mapSrc === "/campus-map-v3.png") {
                          setMapSrc("/campus-map.png");
                          return;
                        }
                        setMapImgError(true);
                      }}
                      className="object-contain"
                      sizes="(max-width: 1024px) 90vw, (max-width: 1536px) 26rem, 30rem"
                      quality={75}
                      priority
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center p-6 text-center">
                      <p className="text-xs text-foreground/70">Add public/campus-map-v3.png (or public/campus-map.png)</p>
                    </div>
                  )}

                  <div
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${Number(x) * 100}%`, top: `${Number(y) * 100}%` }}
                  >
                    <div className="h-4 w-4 rounded-full bg-primary ring-4 ring-primary/30" />
                  </div>
                </div>
              </div>

              {error ? <p className="text-sm font-semibold text-risk">{error}</p> : null}

              {editingId ? (
                <div className="flex items-center gap-2">
                  <Button type="button" onClick={saveEdit}>
                    <MapPin className="h-4 w-4" /> Save
                  </Button>
                  <Button type="button" variant="secondary" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button type="button" onClick={create}>
                  <MapPin className="h-4 w-4" /> Add
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rooms list</CardTitle>
            <CardDescription>Search rooms by code (name), building, or floor.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-foreground/70">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-foreground/70">No rooms yet.</p>
            ) : (
              <div className="space-y-2">
                <div className="grid gap-2 pb-2 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-foreground/70">Search</label>
                    <Input
                      className="mt-1"
                      value={listQuery}
                      onChange={(e) => setListQuery(e.target.value)}
                      placeholder="e.g. N3, MAIN, floor 2"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground/70">Building</label>
                    <select
                      className="mt-1 h-10 w-full rounded-xl border border-foreground/12 bg-panel/30 px-3 text-sm font-semibold text-foreground/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      value={listBuilding}
                      onChange={(e) => setListBuilding(e.target.value)}
                    >
                      <option value="">All</option>
                      {buildingOptions.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground/70">Floor</label>
                    <select
                      className="mt-1 h-10 w-full rounded-xl border border-foreground/12 bg-panel/30 px-3 text-sm font-semibold text-foreground/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      value={listFloor}
                      onChange={(e) => setListFloor(e.target.value)}
                    >
                      <option value="">All</option>
                      {floorOptions.map((f) => (
                        <option key={f} value={String(f)}>
                          Floor {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {filteredItems.map((r) => (
                  <div
                    key={r._id}
                    className="flex w-full items-center justify-between rounded-2xl bg-background p-4 text-left transition hover:bg-background/80"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setEditingId(r._id);
                      setRoomCode(r.roomCode);
                      setBuilding(r.building);
                      setFloor(String(r.floor));
                      setX(String(r.x));
                      setY(String(r.y));
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      setEditingId(r._id);
                      setRoomCode(r.roomCode);
                      setBuilding(r.building);
                      setFloor(String(r.floor));
                      setX(String(r.x));
                      setY(String(r.y));
                      setError(null);
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{r.roomCode}</p>
                      <p className="truncate text-xs text-foreground/70">Building {r.building} • Floor {r.floor} • ({r.x.toFixed(3)}, {r.y.toFixed(3)})</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">{r.building}</Badge>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          del(r._id, r.roomCode);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredItems.length === 0 ? (
                  <p className="text-sm text-foreground/70">No matches.</p>
                ) : null}
              </div>
            )}
            <div className="mt-3">
              <Button type="button" variant="ghost" onClick={load}>Reload</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
