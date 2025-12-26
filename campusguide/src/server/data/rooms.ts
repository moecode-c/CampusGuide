import { cacheDel, cacheGet, cacheSet } from "@/server/cache/cache";
import { connectToDatabase } from "@/server/db";
import { Room } from "@/server/models/Room";

const key = "rooms:list:v1";

export async function getRoomsCached() {
  const cached = cacheGet<any[]>(key);
  // If the cache was populated before rooms existed (e.g. after a fresh seed while the
  // dev server is running), it may hold an empty list. Treat empty as a cache miss.
  if (Array.isArray(cached) && cached.length > 0) return cached;
  await connectToDatabase();
  const rooms = await Room.find({}).sort({ building: 1, floor: 1, roomCode: 1 }).lean();
  cacheSet(key, rooms, 1000 * 60 * 10);
  return rooms;
}

export function invalidateRoomsCache() {
  cacheDel(key);
}
