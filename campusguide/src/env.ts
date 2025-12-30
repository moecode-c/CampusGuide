import { z } from "zod";

const serverSchema = z.object({
  MONGODB_URI: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(20),
  NEXTAUTH_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof serverSchema>;

let cached: Env | null = null;

function shouldSkipValidation() {
  return process.env.SKIP_ENV_VALIDATION === "1" || process.env.NEXT_PHASE === "phase-production-build";
}

function parseServerEnv(): Env {
  const raw = {
    MONGODB_URI: process.env.MONGODB_URI,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  };

  const parsed = serverSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  // During `next build`, Next may evaluate route modules (including NextAuth) even without a local `.env`.
  // Allow the build to complete by using safe placeholders ONLY in the build phase.
  if (shouldSkipValidation()) {
    return {
      ...raw,
      MONGODB_URI: raw.MONGODB_URI ?? "mongodb://127.0.0.1:27017/campusguide",
      NEXTAUTH_SECRET: raw.NEXTAUTH_SECRET ?? "INSECURE_BUILD_TIME_SECRET_PLEASE_SET_NEXTAUTH_SECRET",
    } as Env;
  }

  throw parsed.error;
}

// Lazy env evaluation: avoids failing `next build` when env vars aren't present,
// while still enforcing correctness at runtime when values are actually used.
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    // In dev, Next can reload `.env.local` without restarting the process,
    // so caching can leave you stuck on old values (e.g., localhost Mongo).
    if (process.env.NODE_ENV !== "production") {
      const fresh = parseServerEnv();
      return (fresh as any)[prop as any];
    }

    if (!cached) cached = parseServerEnv();
    return (cached as any)[prop as any];
  },
});
