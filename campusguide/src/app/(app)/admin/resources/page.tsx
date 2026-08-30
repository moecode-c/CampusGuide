"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  Download,
  File as FileIcon,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  Home,
  Link2,
  MoveRight,
  Pen,
  PlayCircle,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { formatBytes } from "@/lib/bytes";

type DriveFolder = {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  createdAt: string | null;
};

type DriveFile = {
  id: string;
  kind: "file" | "link";
  title: string;
  folderId: string | null;
  fileName: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  externalUrl: string | null;
  subject: string | null;
  academicYear: number | null;
  type: "video" | "pdf" | "summary" | null;
  createdAt: string | null;
};

type DriveResponse = {
  mode: "browse" | "search";
  folder: DriveFolder | null;
  breadcrumbs: { id: string; name: string }[];
  folders: DriveFolder[];
  files: DriveFile[];
  storageConfigured: boolean;
};

type UploadJob = { id: string; name: string; progress: number; error?: string };

type DialogState =
  | { type: "none" }
  | { type: "newFolder" }
  | { type: "link" }
  | { type: "renameFolder"; folder: DriveFolder }
  | { type: "renameFile"; file: DriveFile }
  | { type: "moveFolder"; folder: DriveFolder }
  | { type: "moveFile"; file: DriveFile };

/** XHR rather than fetch: only XHR reports upload progress. */
function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (fraction: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("content-type", contentType);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Cloudflare rejected the upload (${xhr.status})`));
    xhr.onerror = () =>
      reject(new Error("Upload failed. Check the R2 bucket's CORS rules allow this origin."));

    xhr.send(file);
  });
}

function iconFor(item: DriveFile) {
  if (item.kind === "link") return <Link2 className="h-5 w-5 text-primary" />;
  const name = `${item.fileName ?? ""} ${item.mimeType ?? ""}`.toLowerCase();
  if (name.includes("pdf")) return <FileText className="h-5 w-5 text-risk" />;
  if (name.includes("video") || name.includes("mp4")) return <PlayCircle className="h-5 w-5 text-primary" />;
  return <FileIcon className="h-5 w-5 text-foreground/60" />;
}

export default function AdminResourcesPage() {
  const [folderId, setFolderId] = React.useState<string | null>(null);
  const [data, setData] = React.useState<DriveResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [uploads, setUploads] = React.useState<UploadJob[]>([]);
  const [dialog, setDialog] = React.useState<DialogState>({ type: "none" });
  const [dragging, setDragging] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const replaceInputRef = React.useRef<HTMLInputElement>(null);
  const replaceTargetRef = React.useRef<string | null>(null);

  // Debouncing narrows the window but does not close it: a slow request for
  // "ab" can still land after a fast one for "abc" and repaint the older
  // results under the newer query. Only the newest request may write state.
  const requestSeq = React.useRef(0);

  const load = React.useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    else if (folderId) params.set("folderId", folderId);

    try {
      const res = await fetch(`/api/admin/drive?${params.toString()}`);
      const j = await res.json().catch(() => null);
      if (seq !== requestSeq.current) return;
      if (!res.ok) {
        setError(j?.error ?? "Failed to load the drive");
        return;
      }
      setData(j as DriveResponse);
      setError(null);
    } catch {
      if (seq === requestSeq.current) setError("Network error. Check your connection and try again.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [folderId, q]);

  React.useEffect(() => {
    const handle = window.setTimeout(load, q ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [load, q]);

  const storageConfigured = data?.storageConfigured ?? true;

  async function call(path: string, init: RequestInit) {
    const res = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j?.error ?? "Request failed");
    return j;
  }

  /** upload-url -> PUT to R2 -> create the resource row (or repoint `replaceId`). */
  async function uploadOne(file: File, targetFolderId: string | null, replaceId: string | null) {
    const jobId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setUploads((prev) => [...prev, { id: jobId, name: file.name, progress: 0 }]);

    const setJob = (patch: Partial<UploadJob>) =>
      setUploads((prev) => prev.map((u) => (u.id === jobId ? { ...u, ...patch } : u)));

    try {
      const signed = await call("/api/admin/resources/upload-url", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        }),
      });

      await putWithProgress(signed.uploadUrl, file, signed.contentType, (f) =>
        setJob({ progress: Math.round(f * 100) })
      );

      if (replaceId) {
        await call(`/api/admin/resources/${replaceId}`, {
          method: "PATCH",
          body: JSON.stringify({ objectKey: signed.key }),
        });
      } else {
        await call("/api/admin/resources", {
          method: "POST",
          body: JSON.stringify({
            kind: "file",
            objectKey: signed.key,
            title: file.name,
            folderId: targetFolderId,
          }),
        });
      }

      setJob({ progress: 100 });
      window.setTimeout(() => setUploads((prev) => prev.filter((u) => u.id !== jobId)), 1200);
    } catch (err) {
      setJob({ error: (err as Error).message });
    }
  }

  /**
   * `replaceId` is passed in rather than read from a ref at upload time.
   * Cancelling the OS file picker fires no event, so a target left on a ref
   * would silently turn the *next* ordinary upload into a replace — overwriting
   * an unrelated resource and deleting its object from R2.
   */
  async function handleFiles(list: FileList | null, replaceId: string | null = null) {
    if (!list?.length) return;
    setError(null);
    setBusy(true);

    const target = folderId;
    try {
      // Only one file can replace a resource; any extras are ordinary uploads.
      let pendingReplaceId = replaceId;
      for (const file of Array.from(list)) {
        await uploadOne(file, target, pendingReplaceId);
        pendingReplaceId = null;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteFolder(folder: DriveFolder) {
    if (
      !confirm(
        `Delete "${folder.name}" and everything inside it?\n\nAll files underneath are permanently removed from Cloudflare too.`
      )
    )
      return;

    setBusy(true);
    try {
      const j = await call(`/api/admin/folders/${folder.id}`, { method: "DELETE" });
      setError(null);
      if (j.deletedFiles) {
        // Nothing to show in the tree afterwards, so surface the count instead.
        console.info(`Deleted ${j.deletedFiles} file(s) from Cloudflare.`);
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteFile(file: DriveFile) {
    const what = file.kind === "file" ? "This also deletes it from Cloudflare." : "";
    if (!confirm(`Delete "${file.title}"? ${what}`)) return;

    setBusy(true);
    try {
      await call(`/api/admin/resources/${file.id}`, { method: "DELETE" });
      setError(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startReplace(file: DriveFile) {
    replaceTargetRef.current = file.id;
    replaceInputRef.current?.click();
  }

  const crumbs = data?.breadcrumbs ?? [];
  const searching = data?.mode === "search";

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">File Storage (Admin)</h1>
      <p className="text-sm text-foreground/70">
        Upload documents into folders. Files live in Cloudflare R2 and are removed from it whenever you
        delete or replace them here.
      </p>

      {!storageConfigured ? (
        <div className="mt-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="font-bold">Cloudflare R2 is not configured.</p>
          <p className="text-foreground/70">
            Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_BASE_URL in
            .env.local, then restart the dev server. Folders and links work without it; uploads do not.
          </p>
        </div>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderIcon className="h-5 w-5 text-primary" />
            {data?.folder ? data.folder.name : "My Files"}
          </CardTitle>
          <CardDescription>
            {searching ? `Search results for "${q}"` : data?.folder?.path ?? "Drive root"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={busy || !storageConfigured}>
                <Upload className="h-4 w-4" /> Upload files
              </Button>
              <Button variant="ghost" onClick={() => setDialog({ type: "newFolder" })} disabled={busy}>
                <FolderPlus className="h-4 w-4" /> New folder
              </Button>
              <Button variant="ghost" onClick={() => setDialog({ type: "link" })} disabled={busy}>
                <Link2 className="h-4 w-4" /> Add link
              </Button>
              <Button variant="ghost" onClick={load} disabled={busy}>
                <RefreshCw className="h-4 w-4" /> Reload
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-foreground/50" />
              <Input
                className="sm:w-64"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search all files…"
              />
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={replaceInputRef}
            type="file"
            hidden
            onChange={(e) => {
              const target = replaceTargetRef.current;
              replaceTargetRef.current = null;
              handleFiles(e.target.files, target);
              e.target.value = "";
            }}
          />

          {!searching ? (
            <nav className="mt-4 flex flex-wrap items-center gap-1 text-sm">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold hover:bg-panel/60"
                onClick={() => setFolderId(null)}
              >
                <Home className="h-4 w-4" /> My Files
              </button>
              {crumbs.map((c) => (
                <React.Fragment key={c.id}>
                  <ChevronRight className="h-4 w-4 text-foreground/40" />
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 font-semibold hover:bg-panel/60"
                    onClick={() => setFolderId(c.id)}
                  >
                    {c.name}
                  </button>
                </React.Fragment>
              ))}
              {data?.folder ? (
                <>
                  <ChevronRight className="h-4 w-4 text-foreground/40" />
                  <span className="rounded-lg px-2 py-1 font-extrabold">{data.folder.name}</span>
                </>
              ) : null}
            </nav>
          ) : null}

          {error ? <p className="mt-3 text-sm font-semibold text-risk">{error}</p> : null}

          {uploads.length ? (
            <div className="mt-4 space-y-2">
              {uploads.map((u) => (
                <div key={u.id} className="rounded-xl bg-background p-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-semibold">{u.name}</span>
                    <span className={u.error ? "text-risk" : "text-foreground/60"}>
                      {u.error ?? `${u.progress}%`}
                    </span>
                  </div>
                  {!u.error ? (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                      <div className="h-full bg-primary transition-all" style={{ width: `${u.progress}%` }} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div
            className={`mt-4 rounded-2xl border-2 border-dashed p-2 transition ${
              dragging ? "border-primary bg-primary/5" : "border-transparent"
            }`}
            onDragOver={(e) => {
              if (!storageConfigured) return;
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (storageConfigured) handleFiles(e.dataTransfer.files);
            }}
          >
            {loading ? (
              <p className="p-3 text-sm text-foreground/70">Loading…</p>
            ) : !data || (data.folders.length === 0 && data.files.length === 0) ? (
              <p className="p-3 text-sm text-foreground/70">
                {searching ? "Nothing matched your search." : "This folder is empty. Drop files here to upload."}
              </p>
            ) : (
              <div className="space-y-2">
                {data.folders.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 rounded-2xl bg-background p-4">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => {
                        setQ("");
                        setFolderId(f.id);
                      }}
                    >
                      <FolderIcon className="h-5 w-5 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-extrabold">{f.name}</span>
                        {searching ? (
                          <span className="block truncate text-[11px] text-foreground/50">{f.path}</span>
                        ) : null}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Rename" onClick={() => setDialog({ type: "renameFolder", folder: f })}>
                        <Pen className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Move" onClick={() => setDialog({ type: "moveFolder", folder: f })}>
                        <MoveRight className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:text-risk" title="Delete" onClick={() => deleteFolder(f)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {data.files.map((it) => {
                  const href = it.kind === "file" ? it.fileUrl : it.externalUrl;
                  return (
                    <div key={it.id} className="flex flex-col gap-3 rounded-2xl bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {iconFor(it)}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold">{it.title}</p>
                          <p className="truncate text-xs text-foreground/70">
                            {it.kind === "file"
                              ? [it.fileName, formatBytes(it.fileSize)].filter(Boolean).join(" • ")
                              : it.externalUrl}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge tone="neutral">{it.kind === "file" ? "File" : "Link"}</Badge>
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            title="Open"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl hover:bg-panel/60"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        ) : null}
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Rename" onClick={() => setDialog({ type: "renameFile", file: it })}>
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Move" onClick={() => setDialog({ type: "moveFile", file: it })}>
                          <MoveRight className="h-4 w-4" />
                        </Button>
                        {it.kind === "file" ? (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Replace file" onClick={() => startReplace(it)} disabled={busy || !storageConfigured}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:text-risk" title="Delete" onClick={() => deleteFile(it)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <DriveDialog
        state={dialog}
        currentFolderId={folderId}
        onClose={() => setDialog({ type: "none" })}
        onDone={async () => {
          setDialog({ type: "none" });
          await load();
        }}
      />
    </div>
  );
}

/** Create / rename / move / add-link, kept in one place so the page body stays readable. */
function DriveDialog({
  state,
  currentFolderId,
  onClose,
  onDone,
}: {
  state: DialogState;
  currentFolderId: string | null;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [linkType, setLinkType] = React.useState<"video" | "pdf" | "summary">("video");
  const [destination, setDestination] = React.useState("root");
  const [folders, setFolders] = React.useState<DriveFolder[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const moving = state.type === "moveFolder" || state.type === "moveFile";

  React.useEffect(() => {
    setError(null);
    setBusy(false);
    if (state.type === "renameFolder") setName(state.folder.name);
    else if (state.type === "renameFile") setName(state.file.title);
    else setName("");
    setUrl("");
    setDestination("root");
  }, [state]);

  React.useEffect(() => {
    if (!moving) return;
    fetch("/api/admin/folders")
      .then((r) => r.json())
      .then((j) => setFolders(j?.folders ?? []))
      .catch(() => setFolders([]));
  }, [moving]);

  if (state.type === "none") return null;

  const titles: Record<Exclude<DialogState["type"], "none">, string> = {
    newFolder: "New folder",
    link: "Add link",
    renameFolder: "Rename folder",
    renameFile: "Rename resource",
    moveFolder: "Move folder",
    moveFile: "Move resource",
  };

  async function submit() {
    setBusy(true);
    setError(null);

    const send = async (path: string, method: string, body: unknown) => {
      const res = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error ?? "Request failed");
    };

    try {
      switch (state.type) {
        case "newFolder":
          await send("/api/admin/folders", "POST", { name: name.trim(), parentId: currentFolderId });
          break;
        case "link":
          await send("/api/admin/resources", "POST", {
            kind: "link",
            title: name.trim(),
            externalUrl: url.trim(),
            // A link tagged "video" also shows up on the student Videos page.
            type: linkType,
            folderId: currentFolderId,
          });
          break;
        case "renameFolder":
          await send(`/api/admin/folders/${state.folder.id}`, "PATCH", { name: name.trim() });
          break;
        case "renameFile":
          await send(`/api/admin/resources/${state.file.id}`, "PATCH", { title: name.trim() });
          break;
        case "moveFolder":
          await send(`/api/admin/folders/${state.folder.id}`, "PATCH", { parentId: destination });
          break;
        case "moveFile":
          await send(`/api/admin/resources/${state.file.id}`, "PATCH", { folderId: destination });
          break;
      }
      await onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = moving ? true : state.type === "link" ? Boolean(name.trim() && url.trim()) : Boolean(name.trim());

  // Moving a folder into itself or its own subtree is rejected server-side; hide
  // the obvious case here so the option never appears.
  const movingFolderId = state.type === "moveFolder" ? state.folder.id : null;
  const movingFolderPath = state.type === "moveFolder" ? state.folder.path : null;
  const destinations = folders.filter(
    (f) =>
      f.id !== movingFolderId &&
      !(movingFolderPath && (f.path === movingFolderPath || f.path.startsWith(`${movingFolderPath}/`)))
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-panel p-6 shadow-xl">
        <h2 className="text-lg font-extrabold">{titles[state.type]}</h2>

        <div className="mt-4 space-y-3">
          {moving ? (
            <div className="space-y-1">
              <label className="text-sm font-semibold">Destination</label>
              <Select value={destination} onChange={(e) => setDestination(e.target.value)}>
                <option value="root">My Files (root)</option>
                {destinations.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.path}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-sm font-semibold">{state.type === "link" ? "Title" : "Name"}</label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={state.type === "link" ? "Lecture recording" : "Lectures"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit && !busy) submit();
                }}
              />
            </div>
          )}

          {state.type === "link" ? (
            <>
              <div className="space-y-1">
                <label className="text-sm font-semibold">URL</label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/…" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold">Type</label>
                <Select value={linkType} onChange={(e) => setLinkType(e.target.value as any)}>
                  <option value="video">Video — also listed on the Videos page</option>
                  <option value="pdf">PDF</option>
                  <option value="summary">Summary</option>
                </Select>
              </div>
            </>
          ) : null}

          {error ? <p className="text-sm font-semibold text-risk">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={submit} disabled={busy || !canSubmit}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
