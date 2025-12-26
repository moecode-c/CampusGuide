import { RateLimiterMemory } from "rate-limiter-flexible";

const limiter = new RateLimiterMemory({
  points: 20,
  duration: 60,
});

export function getRequestIp(headers: Headers) {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  return headers.get("x-real-ip") ?? "unknown";
}

export async function enforceRateLimit(headers: Headers, key: string) {
  const ip = getRequestIp(headers);
  const compositeKey = `${key}:${ip}`;
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
