import { z } from "zod";
import { requireRole } from "@/server/security/requireRole";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { getFlags, setFlag } from "@/server/flags";
import { noStoreJson } from "@/server/httpCache";
import { logActivity } from "@/server/activity";
import { ActivityActions } from "@/lib/activityActions";
import { FLAG_KEYS, flagMeta, isFlagKey, type FlagKey } from "@/lib/flags";

const patchSchema = z
  .object({
    key: z.string().refine(isFlagKey, "Unknown flag"),
    enabled: z.boolean(),
    message: z.string().max(300).optional(),
  })
  .strict();

export async function GET(req: Request) {
  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  const limited = await enforceRateLimit(req.headers, "admin:flags:get", {
    points: 120,
    duration: 60,
    identity: session.user.id,
  });
  if (limited) return limited;

  const flags = await getFlags();
  return noStoreJson({ flags, keys: FLAG_KEYS }, 200);
}

export async function PATCH(req: Request) {
  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  const limited = await enforceRateLimit(req.headers, "admin:flags:patch", {
    points: 30,
    duration: 60,
    identity: session.user.id,
  });
  if (limited) return limited;

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return noStoreJson({ error: "Invalid input" }, 400);

  const key = parsed.data.key as FlagKey;

  await setFlag(key, {
    enabled: parsed.data.enabled,
    message: parsed.data.message ?? null,
    actorId: session.user.id,
    actorName: session.user.name,
  });

  void logActivity({
    action: parsed.data.enabled ? ActivityActions.FlagEnabled : ActivityActions.FlagDisabled,
    actor: { id: session.user.id, name: session.user.name },
    targetType: "flag",
    targetLabel: flagMeta(key).label,
    meta: { key, enabled: parsed.data.enabled },
    headers: req.headers,
  });

  const flags = await getFlags();
  return noStoreJson({ ok: true, flags }, 200);
}
