import { LRUCache } from "lru-cache";

const globalForCache = globalThis as unknown as {
  __appCache: LRUCache<string, any> | undefined;
};

export const appCache =
  globalForCache.__appCache ??
  new LRUCache<string, any>({
    max: 500,
    ttl: 1000 * 60 * 5,
  });

if (process.env.NODE_ENV !== "production") globalForCache.__appCache = appCache;

export function cacheGet<T>(key: string): T | undefined {
  return appCache.get(key) as T | undefined;
}

export function cacheSet<T>(key: string, value: T, ttlMs?: number) {
  appCache.set(key, value, ttlMs ? { ttl: ttlMs } : undefined);
}

export function cacheDel(key: string) {
  appCache.delete(key);
}
