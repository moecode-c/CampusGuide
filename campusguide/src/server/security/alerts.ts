import { ActivityLog } from "@/server/models/ActivityLog";
import { SecurityAlert } from "@/server/models/SecurityAlert";
import { connectToDatabase } from "@/server/db";
import { ActivityActions, type ActivityAction } from "@/lib/activityActions";
import { AlertRules, AlertTypes, explainAlert, type AlertType } from "@/lib/alerts";

/**
 * Suspicious-activity detection.
 *
 * Every rule is the same shape: count matching rows in the activity log over a
 * rolling window, and raise an alert when the count crosses a threshold. The
 * activity log is already written for these events, so detection costs one
 * count query rather than a second event store.
 *
 * Nothing here may throw. A failed detection must never turn a failed login
 * into a 500, or block the request that triggered it.
 */

/**
 * Every event is evaluated. An earlier version throttled evaluation to one per
 * subject per 20s to save count queries, which defeated the whole feature: the
 * throttle armed on the *first* failure of a burst, so attempts 2..n were
 * skipped and a five-attempt guess never crossed its own threshold.
 *
 * The queries are indexed and every path here is inherently low volume — auth
 * failures are rare, and rate-limit breaches are already bounded by the
 * limiter that produced them. Deduplication is the upsert's job, not a timer's.
 */

function since(minutes: number) {
  return new Date(Date.now() - minutes * 60_000);
}

/**
 * Creates the alert, or folds the event into the open one for this subject.
 *
 * The upsert is guarded by a partial unique index on (type, subject) for
 * unacknowledged rows, so two concurrent detections can't produce two alerts.
 */
async function raiseAlert(input: {
  type: AlertType;
  subject: string;
  subjectLabel?: string | null;
  userId?: string | null;
  count: number;
}) {
  const rule = AlertRules[input.type];

  try {
    await SecurityAlert.updateOne(
      { type: input.type, subject: input.subject, acknowledgedAt: { $exists: false } },
      {
        $set: {
          severity: rule.severity,
          count: input.count,
          message: explainAlert(input.type, input.count),
          subjectLabel: input.subjectLabel ?? undefined,
          userId: input.userId ?? undefined,
          lastSeenAt: new Date(),
        },
        $setOnInsert: {
          type: input.type,
          subject: input.subject,
          firstSeenAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (err) {
    // A duplicate-key race means another request just raised the same alert.
    // That is the desired end state, so treat it as success.
    if ((err as { code?: number })?.code === 11000) return;
    console.error("security alert write failed", err);
  }
}

/** Counts matching activity rows inside the rule's window. */
async function countRecent(action: ActivityAction, windowMinutes: number, extra: Record<string, unknown>) {
  return ActivityLog.countDocuments({
    action,
    createdAt: { $gte: since(windowMinutes) },
    ...extra,
  });
}

type AuthFailureKind = "bad_password" | "unknown_account" | "banned";

/**
 * Records a rejected sign-in and evaluates the auth rules.
 *
 * These were previously silent — `authorize()` returned null and nothing was
 * written — which left the single most useful security signal unrecorded.
 */
export async function recordAuthFailure(input: {
  kind: AuthFailureKind;
  identifier: string;
  ip?: string;
  userId?: string | null;
  name?: string | null;
}) {
  try {
    await connectToDatabase();

    const action =
      input.kind === "banned"
        ? ActivityActions.SignInBanned
        : input.kind === "unknown_account"
          ? ActivityActions.SignInUnknown
          : ActivityActions.SignInFailed;

    await ActivityLog.create({
      action,
      actorId: input.userId ?? undefined,
      actorName: input.name ?? undefined,
      // The typed identifier, not a password — never log the credential itself.
      targetLabel: input.identifier,
      targetType: "auth",
      ip: input.ip,
      createdAt: new Date(),
    });

    // A banned account trying to get back in is worth surfacing on its own,
    // with no threshold: it is a deliberate act by a known person.
    if (input.kind === "banned") {
      const rule = AlertRules[AlertTypes.BannedAttempt];
      const count = await countRecent(ActivityActions.SignInBanned, rule.windowMinutes, {
        targetLabel: input.identifier,
      });
      await raiseAlert({
        type: AlertTypes.BannedAttempt,
        subject: input.userId ?? input.identifier,
        subjectLabel: input.name ?? input.identifier,
        userId: input.userId,
        count,
      });
      return;
    }

    if (input.kind === "unknown_account") {
      if (!input.ip) return;
      const rule = AlertRules[AlertTypes.UnknownAccounts];
      const count = await countRecent(ActivityActions.SignInUnknown, rule.windowMinutes, { ip: input.ip });
      if (count >= rule.count) {
        await raiseAlert({
          type: AlertTypes.UnknownAccounts,
          subject: input.ip,
          subjectLabel: input.ip,
          count,
        });
      }
      return;
    }

    // bad_password: the account exists, so track it per account. Ties the alert
    // to a real student the admin can click through to and ban.
    const rule = AlertRules[AlertTypes.BruteForce];
    const count = await countRecent(ActivityActions.SignInFailed, rule.windowMinutes, {
      targetLabel: input.identifier,
    });
    if (count >= rule.count) {
      await raiseAlert({
        type: AlertTypes.BruteForce,
        subject: input.userId ?? input.identifier,
        subjectLabel: input.name ?? input.identifier,
        userId: input.userId,
        count,
      });
    }
  } catch (err) {
    console.error("auth failure detection failed", err);
  }
}

/**
 * One account seen from several addresses in an hour. Low severity on purpose —
 * a phone dropping to mobile data looks the same as a shared password, so this
 * is a nudge to look, not an accusation.
 */
export async function recordSignInSuccess(input: { userId: string; name?: string | null; ip?: string }) {
  try {
    if (!input.ip) return;
    await connectToDatabase();

    const rule = AlertRules[AlertTypes.SharedAccount];
    const ips: unknown[] = await ActivityLog.distinct("ip", {
      action: ActivityActions.SignIn,
      actorId: input.userId,
      createdAt: { $gte: since(rule.windowMinutes) },
      ip: { $nin: [null, "", "unknown"] },
    });

    if (ips.length >= rule.count) {
      await raiseAlert({
        type: AlertTypes.SharedAccount,
        subject: input.userId,
        subjectLabel: input.name ?? input.userId,
        userId: input.userId,
        count: ips.length,
      });
    }
  } catch (err) {
    console.error("shared-account detection failed", err);
  }
}

/** Sustained 429s from one caller: a script, a scraper, or a broken client. */
export async function recordRateLimitBreach(input: { routeKey: string; identity: string; ip?: string }) {
  try {
    const subject = input.identity;

    await connectToDatabase();

    await ActivityLog.create({
      action: ActivityActions.RateLimited,
      targetType: "endpoint",
      targetLabel: input.routeKey,
      meta: { identity: input.identity },
      ip: input.ip,
      createdAt: new Date(),
    });

    const rule = AlertRules[AlertTypes.RateAbuse];
    const count = await countRecent(ActivityActions.RateLimited, rule.windowMinutes, {
      "meta.identity": input.identity,
    });

    if (count >= rule.count) {
      await raiseAlert({
        type: AlertTypes.RateAbuse,
        subject,
        subjectLabel: input.routeKey,
        count,
      });
    }
  } catch (err) {
    console.error("rate-limit detection failed", err);
  }
}

/** A burst of deletions by one admin — a mistake, or a compromised account. */
export async function recordDeletion(input: { actorId: string; actorName?: string | null }) {
  try {
    await connectToDatabase();

    const rule = AlertRules[AlertTypes.MassDeletion];
    const count = await ActivityLog.countDocuments({
      actorId: input.actorId,
      action: {
        $in: [
          ActivityActions.ResourceDelete,
          ActivityActions.FolderDelete,
          ActivityActions.UserDelete,
          ActivityActions.TeamPostDelete,
          ActivityActions.VideoCourseDelete,
        ],
      },
      createdAt: { $gte: since(rule.windowMinutes) },
    });

    if (count >= rule.count) {
      await raiseAlert({
        type: AlertTypes.MassDeletion,
        subject: input.actorId,
        subjectLabel: input.actorName ?? input.actorId,
        userId: input.actorId,
        count,
      });
    }
  } catch (err) {
    console.error("mass-deletion detection failed", err);
  }
}
