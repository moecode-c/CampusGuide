"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export function ScheduleManager({ onUpdate }: { onUpdate: () => void }) {
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [msg, setMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

    // Manual Form State
    const [title, setTitle] = React.useState("");
    const [type, setType] = React.useState<"lecture" | "lab">("lecture");
    const [dow, setDow] = React.useState("SA");
    const [start, setStart] = React.useState("09:00");
    const [end, setEnd] = React.useState("10:00");
    const [prof, setProf] = React.useState("");
    const [room, setRoom] = React.useState("");

    function reset() {
        setMsg(null);
        setBusy(false);
        setTitle("");
        setProf("");
        setRoom("");
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);

        if (end <= start) {
            setMsg({ type: "error", text: "End time must be after start time." });
            return;
        }

        setBusy(true);

        const row = {
            title,
            type,
            dayOfWeek: dow,
            startTime: start,
            endTime: end,
            professor: prof || undefined,
            roomCode: room || undefined,
        };

        try {
            const res = await fetch("/api/student/schedule/import", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ rows: [row] }),
            });

            if (res.ok) {
                setMsg({ type: "success", text: "Class added successfully!" });
                onUpdate();
                window.dispatchEvent(new Event("cg:calendar:refetch"));
                setTitle("");
                setProf("");
                setRoom("");
            } else {
                const j = await res.json().catch(() => ({}));
                setMsg({ type: "error", text: j.error ?? "Failed to add class" });
            }
        } catch {
            setMsg({ type: "error", text: "Network error. Please try again." });
        } finally {
            // Without a finally the button stays disabled forever on a failed request.
            setBusy(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v: boolean) => { setOpen(v); if (v) reset(); }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Class
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-105 bg-panel text-foreground border border-foreground/10 shadow-xl shadow-primary/10">
                <DialogHeader>
                    <DialogTitle className="text-foreground">Add Class</DialogTitle>
                    <DialogDescription className="text-foreground/70">Add a class to your weekly schedule.</DialogDescription>
                </DialogHeader>

                {msg && (
                    <div className={`p-3 rounded-xl text-sm flex items-center gap-2 border ${msg.type === "success" ? "bg-success/10 text-foreground border-success/25" : "bg-risk/10 text-foreground border-risk/25"}`}>
                        {msg.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        {msg.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-foreground/80">Course Title</label>
                        <Input
                            required
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Data Structures & Algorithms"
                            className="bg-background/40 border-foreground/15 text-foreground placeholder:text-foreground/50 focus:ring-accent/40"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-foreground/80">Type</label>
                            <Select
                                value={type}
                                onChange={e => setType(e.target.value as any)}
                                className="bg-background/40 border-foreground/15 text-foreground focus:ring-accent/40"
                            >
                                <option value="lecture">Lecture</option>
                                <option value="lab">Lab</option>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-foreground/80">Day</label>
                            <Select
                                value={dow}
                                onChange={e => setDow(e.target.value)}
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
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-foreground/80">Start Time</label>
                            <Input
                                required
                                type="time"
                                value={start}
                                onChange={e => setStart(e.target.value)}
                                className="bg-background/40 border-foreground/15 text-foreground focus:ring-accent/40"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-foreground/80">End Time</label>
                            <Input
                                required
                                type="time"
                                value={end}
                                onChange={e => setEnd(e.target.value)}
                                className="bg-background/40 border-foreground/15 text-foreground focus:ring-accent/40"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-foreground/80">Professor (optional)</label>
                        <Input
                            value={prof}
                            onChange={e => setProf(e.target.value)}
                            placeholder="Dr. Ahmed Hassan"
                            className="bg-background/40 border-foreground/15 text-foreground placeholder:text-foreground/50 focus:ring-accent/40"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-foreground/80">Room (optional)</label>
                        <Input
                            value={room}
                            onChange={e => setRoom(e.target.value)}
                            placeholder="e.g. RC1-242"
                            className="bg-background/40 border-foreground/15 text-foreground placeholder:text-foreground/50 focus:ring-accent/40"
                        />
                    </div>

                    <Button type="submit" className="w-full shadow-lg shadow-primary/20" disabled={busy}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Class"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
