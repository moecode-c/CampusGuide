import { cacheDel, cacheGet, cacheSet } from "@/server/cache/cache";
import { connectToDatabase } from "@/server/db";
import { Resource } from "@/server/models/Resource";

const key = "resources:list:v1";

export async function getResourcesCached() {
  const cached = cacheGet<any[]>(key);
  if (cached) return cached;
  await connectToDatabase();
  const items = await Resource.find({}).sort({ createdAt: -1 }).lean();
  cacheSet(key, items, 1000 * 60 * 5);
  return items;
}

export function invalidateResourcesCache() {
  cacheDel(key);
}
