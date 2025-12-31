import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireSession } from "@/server/security/requireSession";
import { getRoomsCached } from "@/server/data/rooms";
import { connectToDatabase } from "@/server/db";
import { Event, EventTypes } from "@/server/models/Event";
import { getSemesterTemplateForYear } from "@/server/data/semesterTemplates";
import { RRule } from "rrule";
import { computeExdatesForRule } from "@/server/calendar/exdates";
import { jsonWithEtag } from "@/server/httpCache";

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "student:map:get");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const rooms = await getRoomsCached();

  await connectToDatabase();
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const tpl = await getSemesterTemplateForYear(session.user.academicYear);
  const excluded = (tpl?.excludedRanges ?? []).map((r: any) => ({ start: new Date(r.start), end: new Date(r.end) }));

  const oneOff = await Event.find({
    userId: session.user.id,
    type: { $in: [EventTypes.Lecture, EventTypes.Lab] },
    roomCode: { $exists: true, $ne: null },
    start: { $gte: now, $lte: in7 },
    isRecurring: { $ne: true },
  })
    .sort({ start: 1 })
    .select({ title: 1, type: 1, start: 1, end: 1, roomCode: 1 })
    .lean();

  const scheduleRoomCodesRaw = await Event.find({
    userId: session.user.id,
    type: { $in: [EventTypes.Lecture, EventTypes.Lab] },
    roomCode: { $exists: true, $ne: null },
  })
    .select({ roomCode: 1 })
    .lean();

  const scheduleRoomCodes = Array.from(
    new Set(
      (scheduleRoomCodesRaw as any[])
        .map((e) => String(e.roomCode ?? "").trim().toUpperCase())
        .filter(Boolean)
    )
  );

  const recurring = await Event.find({
    userId: session.user.id,
    type: { $in: [EventTypes.Lecture, EventTypes.Lab] },
    roomCode: { $exists: true, $ne: null },
    isRecurring: true,
    rrule: { $exists: true, $ne: null },
  })
    .select({ title: 1, type: 1, start: 1, end: 1, roomCode: 1, rrule: 1 })
    .lean();

  const expanded: Array<{ title: string; type: string; start: string; end: string; roomCode: string }> = [];
  for (const e of recurring as any[]) {
    const dtstart = new Date(e.start);
    const dtend = new Date(e.end);
    const durationMs = dtend.getTime() - dtstart.getTime();

    try {
      const parsed = RRule.fromString(String(e.rrule));
      const rule = new RRule({ ...parsed.origOptions, dtstart });
      const exdate = computeExdatesForRule({ rrule: rule, dtstart, excludedRanges: excluded });
      const exSet = new Set((exdate ?? []).map((d: any) => new Date(d).toISOString()));

      const starts = rule.between(now, in7, true);
      for (const s of starts) {
        const startIso = s.toISOString();
        if (exSet.has(startIso)) continue;
        const endIso = new Date(s.getTime() + durationMs).toISOString();
        expanded.push({ title: e.title, type: e.type, start: startIso, end: endIso, roomCode: String(e.roomCode) });
      }
    } catch {
      // Ignore malformed RRULEs; they can be corrected in Calendar.
    }
  }

  const upcoming = [...(oneOff as any[]).map((e) => ({ ...e, start: new Date(e.start).toISOString(), end: new Date(e.end).toISOString(), roomCode: String(e.roomCode) })), ...expanded]
    .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 60);

  return jsonWithEtag(
    req,
    {
      rooms: rooms.map((r: any) => ({ roomCode: r.roomCode, building: r.building, floor: r.floor, x: r.x, y: r.y })),
      upcoming,
      scheduleRoomCodes,
    },
    { cacheControl: "private, max-age=0, must-revalidate" }
  );
}
