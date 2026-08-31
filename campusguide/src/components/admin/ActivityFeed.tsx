"use client";

import * as React from "react";
import {
  Ban,
  CheckCircle2,
  FilePlus2,
  FileX2,
  FolderPlus,
  Gauge,
  KeyRound,
  Lock,
  LogIn,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unlock,
  UploadCloud,
  UserPlus,
  UserX,
  Users,
  XCircle,
} from "lucide-react";

export type ActivityItem = {
  id: string;
  action: string;
  actorName: string | null;
  actorMiuId: string | null;
  targetLabel: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string | null;
};

/** action -> how it reads in the feed, and which icon carries it. */
const PRESENTATION: Record<string, { icon: React.ReactNode; verb: string; tone?: string }> = {
  "auth.register": { icon: <UserPlus className="h-4 w-4" />, verb: "registered" },
  "admin.user.create": { icon: <UserPlus className="h-4 w-4" />, verb: "created an account for" },
  "auth.signin": { icon: <LogIn className="h-4 w-4" />, verb: "signed in" },
  "admin.user.verify": { icon: <CheckCircle2 className="h-4 w-4" />, verb: "verified", tone: "text-success" },
  "admin.user.reject": { icon: <XCircle className="h-4 w-4" />, verb: "rejected", tone: "text-risk" },
  "admin.user.ban": { icon: <Ban className="h-4 w-4" />, verb: "banned", tone: "text-risk" },
  "admin.user.unban": { icon: <RefreshCw className="h-4 w-4" />, verb: "unbanned" },
  "admin.user.delete": { icon: <Trash2 className="h-4 w-4" />, verb: "deleted account", tone: "text-risk" },
  "admin.user.update": { icon: <Pencil className="h-4 w-4" />, verb: "edited the account of" },
  "admin.user.password_reset": { icon: <KeyRound className="h-4 w-4" />, verb: "reset the password for", tone: "text-warning" },
  "resource.create": { icon: <UploadCloud className="h-4 w-4" />, verb: "added" },
  "resource.update": { icon: <Pencil className="h-4 w-4" />, verb: "edited" },
  "resource.replace": { icon: <RefreshCw className="h-4 w-4" />, verb: "replaced" },
  "resource.delete": { icon: <FileX2 className="h-4 w-4" />, verb: "deleted", tone: "text-risk" },
  "folder.create": { icon: <FolderPlus className="h-4 w-4" />, verb: "created folder" },
  "folder.update": { icon: <Pencil className="h-4 w-4" />, verb: "renamed or moved folder" },
  "folder.delete": { icon: <Trash2 className="h-4 w-4" />, verb: "deleted folder", tone: "text-risk" },
  "schedule.import": { icon: <FilePlus2 className="h-4 w-4" />, verb: "imported a schedule" },
  "team.post.create": { icon: <Users className="h-4 w-4" />, verb: "posted a team ad" },
  "team.post.delete": { icon: <Trash2 className="h-4 w-4" />, verb: "removed a team ad", tone: "text-risk" },
  "team.post.purge": { icon: <Trash2 className="h-4 w-4" />, verb: "cleared out", tone: "text-risk" },
  "auth.signin.failed": { icon: <KeyRound className="h-4 w-4" />, verb: "failed to sign in", tone: "text-warning" },
  "auth.signin.unknown": { icon: <UserX className="h-4 w-4" />, verb: "tried an account that doesn't exist", tone: "text-warning" },
  "auth.signin.banned": { icon: <Ban className="h-4 w-4" />, verb: "banned account tried to sign in", tone: "text-risk" },
  "abuse.rate_limited": { icon: <Gauge className="h-4 w-4" />, verb: "hit a rate limit", tone: "text-warning" },
  "admin.flag.enable": { icon: <Lock className="h-4 w-4" />, verb: "locked", tone: "text-risk" },
  "admin.flag.disable": { icon: <Unlock className="h-4 w-4" />, verb: "unlocked", tone: "text-success" },
  "admin.alert.ack": { icon: <ShieldCheck className="h-4 w-4" />, verb: "acknowledged an alert" },
  "security.ip.block": { icon: <Ban className="h-4 w-4" />, verb: "blocked the address", tone: "text-risk" },
  "security.ip.unblock": { icon: <Unlock className="h-4 w-4" />, verb: "unblocked the address", tone: "text-success" },
  "video.course.create": { icon: <FilePlus2 className="h-4 w-4" />, verb: "created video course" },
  "video.course.update": { icon: <Pencil className="h-4 w-4" />, verb: "edited video course" },
  "video.course.delete": { icon: <Trash2 className="h-4 w-4" />, verb: "deleted video course", tone: "text-risk" },
};

function relative(iso: string | null) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ActivityFeed({
  items,
  compact = false,
  emptyMessage = "No activity recorded yet.",
  onBlockIp,
  blockedIps,
}: {
  items: ActivityItem[];
  compact?: boolean;
  emptyMessage?: string;
  /** Omitted on the dashboard's read-only feed; supplied on the log page. */
  onBlockIp?: (ip: string) => void;
  blockedIps?: Set<string>;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-foreground/70">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const preset = PRESENTATION[item.action] ?? {
          icon: <Pencil className="h-4 w-4" />,
          verb: item.action,
        };
        const isBlocked = Boolean(item.ip && blockedIps?.has(item.ip));

        return (
          <li
            key={item.id}
            className={`flex items-start gap-3 rounded-xl bg-background ${compact ? "p-2.5" : "p-3"}`}
          >
            <span className={`mt-0.5 shrink-0 ${preset.tone ?? "text-foreground/60"}`}>{preset.icon}</span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                <span className="font-extrabold">{item.actorName ?? "Someone"}</span>
                {item.actorMiuId ? <span className="text-foreground/60"> ({item.actorMiuId})</span> : null}{" "}
                <span className="text-foreground/80">{preset.verb}</span>
                {item.targetLabel ? <span className="font-semibold"> {item.targetLabel}</span> : null}
              </p>
              {typeof item.meta?.reason === "string" ? (
                <p className="truncate text-xs text-foreground/60">{item.meta.reason}</p>
              ) : null}
              {item.ip && !compact ? (
                <p className="mt-0.5 font-mono text-[11px] text-foreground/45">{item.ip}</p>
              ) : null}
            </div>

            <span className="shrink-0 text-[11px] text-foreground/50">{relative(item.createdAt)}</span>

            {onBlockIp && item.ip ? (
              isBlocked ? (
                <span
                  title={`${item.ip} is blocked`}
                  className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-risk"
                >
                  Blocked
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onBlockIp(item.ip!)}
                  title={`Block ${item.ip}`}
                  aria-label={`Block ${item.ip}`}
                  className="shrink-0 rounded-lg p-1.5 text-foreground/40 transition-colors hover:bg-risk/10 hover:text-risk"
                >
                  <Ban className="h-4 w-4" />
                </button>
              )
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
