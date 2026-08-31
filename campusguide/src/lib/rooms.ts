/**
 * Matching a schedule's room code against the seeded map rooms.
 *
 * Students type room codes into their timetable by hand, or export them from a
 * sheet that writes "RC-1", "rc 1" or "Room 204". The map only stores one
 * spelling per room, so comparing the two strings directly leaves a class with
 * no pin and no explanation. Everything is compared on letters and digits
 * alone, which is enough to bridge the spellings without merging two real
 * rooms — "204" and "R204" still stay apart.
 */

export type RoomLike = { roomCode: string };

/** The comparison key: uppercase, letters and digits only. */
export function roomCodeKey(code: string | null | undefined) {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function indexRoomsByCode<T extends RoomLike>(rooms: readonly T[]) {
  const index = new Map<string, T>();
  for (const room of rooms) {
    const key = roomCodeKey(room.roomCode);
    // First writer wins so a later near-duplicate can't steal an exact code.
    if (key && !index.has(key)) index.set(key, room);
  }
  return index;
}

export function findRoomByCode<T extends RoomLike>(rooms: readonly T[], code: string | null | undefined) {
  const key = roomCodeKey(code);
  if (!key) return null;
  return rooms.find((r) => roomCodeKey(r.roomCode) === key) ?? null;
}

/**
 * Splits the room codes on a student's schedule into the ones the map can
 * place and the ones it has never heard of, so the UI can say which is which.
 */
export function matchScheduleRooms<T extends RoomLike>(rooms: readonly T[], scheduleCodes: readonly string[]) {
  const index = indexRoomsByCode(rooms);
  const placed = new Map<string, T>();
  const unknown: string[] = [];

  for (const code of scheduleCodes) {
    const key = roomCodeKey(code);
    if (!key) continue;

    const room = index.get(key);
    if (room) {
      placed.set(roomCodeKey(room.roomCode), room);
      continue;
    }

    const label = String(code).trim().toUpperCase();
    if (!unknown.includes(label)) unknown.push(label);
  }

  return { placed: Array.from(placed.values()), unknown };
}
