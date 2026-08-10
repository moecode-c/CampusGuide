"use client";

import * as React from "react";
import {
  Ban,
  CheckCircle2,
  FilePlus2,
  FileX2,
  FolderPlus,
  LogIn,
  Pencil,
  RefreshCw,
  Trash2,
  UploadCloud,
  UserPlus,
  XCircle,
} from "lucide-react";

export type ActivityItem = {
  id: string;
  action: string;
  actorName: string | null;
  actorMiuId: string | null;
  targetLabel: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string | null;
};

/** action -> how it reads in the feed, and which icon carries it. */
const PRESENTATION: Record<string, { icon: React.ReactNode; verb: string; tone?: string }> = {
  "auth.register": { icon: <UserPlus className="h-4 w-4" />, verb: "registered" },
  "auth.signin": { icon: <LogIn className="h-4 w-4" />, verb: "signed in" },
  "admin.user.verify": { icon: <CheckCircle2 className="h-4 w-4" />, verb: "verified", tone: "text-success" },
  "admin.user.reject": { icon: <XCircle className="h-4 w-4" />, verb: "rejected", tone: "text-risk" },
  "admin.user.ban": { icon: <Ban className="h-4 w-4" />, verb: "banned", tone: "text-risk" },
  "admin.user.unban": { icon: <RefreshCw className="h-4 w-4" />, verb: "unbanned" },
  "admin.user.delete": { icon: <Trash2 className="h-4 w-4" />, verb: "deleted account", tone: "text-risk" },
  "resource.create": { icon: <UploadCloud className="h-4 w-4" />, verb: "added" },
  "resource.update": { icon: <Pencil className="h-4 w-4" />, verb: "edited" },
  "resource.replace": { icon: <RefreshCw className="h-4 w-4" />, verb: "replaced" },
  "resource.delete": { icon: <FileX2 className="h-4 w-4" />, verb: "deleted", tone: "text-risk" },
  "folder.create": { icon: <FolderPlus className="h-4 w-4" />, verb: "created folder" },
  "folder.update": { icon: <Pencil className="h-4 w-4" />, verb: "renamed or moved folder" },
  "folder.delete": { icon: <Trash2 className="h-4 w-4" />, verb: "deleted folder", tone: "text-risk" },
  "schedule.import": { icon: <FilePlus2 className="h-4 w-4" />, verb: "imported a schedule" },
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
}: {
  items: ActivityItem[];
  compact?: boolean;
  emptyMessage?: string;
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
            </div>

            <span className="shrink-0 text-[11px] text-foreground/50">{relative(item.createdAt)}</span>
          </li>
        );
      })}
    </ul>
  );
}
