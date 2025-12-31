import { RateLimiterMemory } from "rate-limiter-flexible";

type RateLimitOptions = {
  points?: number;
  duration?: number;
  identity?: string;
};

const defaultPoints = 20;
const defaultDuration = 60;

const limiters = new Map<string, RateLimiterMemory>();

function getLimiter(points: number, duration: number) {
  const key = `${points}:${duration}`;
  const existing = limiters.get(key);
  if (existing) return existing;

  const created = new RateLimiterMemory({ points, duration });
  limiters.set(key, created);
  return created;
}

export function getRequestIp(headers: Headers) {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  return headers.get("x-real-ip") ?? "unknown";
}

export async function enforceRateLimit(headers: Headers, key: string, opts?: RateLimitOptions) {
  const points = opts?.points ?? defaultPoints;
  const duration = opts?.duration ?? defaultDuration;

  const identity = opts?.identity ?? getRequestIp(headers);
  const compositeKey = `${key}:${identity}`;

  const limiter = getLimiter(points, duration);
  try {
    await limiter.consume(compositeKey);
    return null;
  } catch {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }
}
