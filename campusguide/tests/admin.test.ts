/**
 * Admin-surface API tests against a running server.
 *
 *   npx next start -p 3102
 *   BASE_URL=http://localhost:3102 npx tsx --test tests/admin.test.ts
 *
 * Seeds a temporary admin straight into MongoDB, then drives the HTTP API.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

const BASE = process.env.BASE_URL ?? "http://localhost:3102";
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/campusguide";

const stamp = Date.now();
const EMAIL = `cg-admin-${stamp}@example.com`;
const PASSWORD = "AdminPass123";
const ROOM_CODE = `T${String(stamp).slice(-5)}`;

const jar = new Map<string, string>();
const createdRoomIds: string[] = [];
const createdResourceIds: string[] = [];
const createdFolderIds: string[] = [];
const ROOT_FOLDER = `CG Test Drive ${stamp}`;

// A second, disposable student account used to prove that a ban takes effect
// immediately on a session that is already signed in.
const VICTIM_MIU_ID = `2023/${String(stamp).slice(-5)}`;
const VICTIM_EMAIL = `cgvictim23${String(stamp).slice(-5)}@miuegypt.edu.eg`;
const VICTIM_PASSWORD = "VictimPass123";
let victimId = "";

function cookieHeader() {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(res: Response) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (value) jar.set(name, value);
    else jar.delete(name);
  }
}

async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const cookies = cookieHeader();
  if (cookies) headers.set("cookie", cookies);
  const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
  storeCookies(res);
  return res;
}

const json = (res: Response) => res.json().catch(() => null);

function post(path: string, body: unknown) {
  return api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function patch(path: string, body: unknown) {
  return api(path, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

before(async () => {
  try {
    await fetch(`${BASE}/api/auth/csrf`);
  } catch {
    throw new Error(`No server at ${BASE}. Start it with: npx next start -p 3102`);
  }

  await mongoose.connect(MONGODB_URI, { dbName: "campusguide" });
  await mongoose.connection.db!.collection("users").insertOne({
    email: EMAIL,
    name: "CG Admin",
    passwordHash: await bcrypt.hash(PASSWORD, 10),
    role: "admin",
    academicYear: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const { csrfToken } = await json(await api("/api/auth/csrf"));
  await api("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD, callbackUrl: `${BASE}/admin`, json: "true" }),
  });

  const session = await json(await api("/api/auth/session"));
  assert.equal(session?.user?.role, "admin", "admin sign-in failed; the rest of this suite would be meaningless");
});

// -------------------------------------------------------------------- rooms

test("an admin can create a room", async () => {
  const res = await post("/api/admin/rooms", { roomCode: ROOM_CODE, building: "t", floor: 2, x: 0.25, y: 0.75 });
  assert.equal(res.status, 201);
  const id = (await json(res))?.id;
  assert.ok(id);
  createdRoomIds.push(id);
});

test("room codes and buildings are stored upper-cased", async () => {
  const items = (await json(await api("/api/admin/rooms")))?.items ?? [];
  const room = items.find((r: any) => r._id === createdRoomIds[0]);
  assert.ok(room);
  assert.equal(room.roomCode, ROOM_CODE.toUpperCase());
  assert.equal(room.building, "T");
});

test("a duplicate room code returns 409, not an opaque 500", async () => {
  const res = await post("/api/admin/rooms", { roomCode: ROOM_CODE, building: "T", floor: 2, x: 0.25, y: 0.75 });
  assert.equal(res.status, 409);
  assert.match(String((await json(res))?.error), /already exists/i);
});

test("out-of-range map coordinates are rejected", async () => {
  for (const coords of [{ x: 1.5, y: 0.5 }, { x: 0.5, y: -0.2 }]) {
    const res = await post("/api/admin/rooms", { roomCode: `X${stamp}`, building: "X", floor: 1, ...coords });
    assert.equal(res.status, 400, `coords ${JSON.stringify(coords)} should be rejected`);
  }
});

test("a room can be updated and the change is readable back", async () => {
  const res = await patch(`/api/admin/rooms/${createdRoomIds[0]}`, { floor: 5, x: 0.1, y: 0.9 });
  assert.equal(res.status, 200);
  const item = (await json(res))?.item;
  assert.equal(item?.floor, 5);
  assert.equal(item?.x, 0.1);

  const items = (await json(await api("/api/admin/rooms")))?.items ?? [];
  assert.equal(items.find((r: any) => r._id === createdRoomIds[0])?.floor, 5);
});

test("an empty room PATCH is a 400 rather than a Mongo '$set is empty' 500", async () => {
  const res = await patch(`/api/admin/rooms/${createdRoomIds[0]}`, {});
  assert.equal(res.status, 400);
  assert.match(String((await json(res))?.error), /no fields/i);
});

test("a room PATCH rejects unknown fields and malformed ids", async () => {
  assert.equal((await patch(`/api/admin/rooms/${createdRoomIds[0]}`, { nope: 1 })).status, 400);
  assert.equal((await patch("/api/admin/rooms/not-an-id", { floor: 1 })).status, 400);
});

test("renaming a room onto an existing code returns 409", async () => {
  const second = await post("/api/admin/rooms", { roomCode: `${ROOM_CODE}B`, building: "T", floor: 1, x: 0.4, y: 0.4 });
  assert.equal(second.status, 201);
  const secondId = (await json(second))?.id;
  createdRoomIds.push(secondId);

  const res = await patch(`/api/admin/rooms/${secondId}`, { roomCode: ROOM_CODE });
  assert.equal(res.status, 409);
});

test("deleting a missing room is 404, not 500", async () => {
  const res = await api("/api/admin/rooms/0123456789abcdef01234567", { method: "DELETE" });
  assert.equal(res.status, 404);
});

test("a deleted room disappears from the student map straight away", async () => {
  const before = (await json(await api("/api/student/map")))?.rooms ?? [];
  assert.ok(before.some((r: any) => r.roomCode === ROOM_CODE.toUpperCase()), "the new room should be cached in already");

  const del = await api(`/api/admin/rooms/${createdRoomIds[0]}`, { method: "DELETE" });
  assert.equal(del.status, 200);
  createdRoomIds.shift();

  const after = (await json(await api("/api/student/map")))?.rooms ?? [];
  assert.ok(
    !after.some((r: any) => r.roomCode === ROOM_CODE.toUpperCase()),
    "the rooms cache must be invalidated on delete"
  );
});

// ---------------------------------------------------------------- resources

test("a bare host is stored as an absolute https URL", async () => {
  const res = await post("/api/admin/resources", {
    title: `CG Test Bare ${stamp}`,
    subject: "CG Testing",
    academicYear: 1,
    type: "pdf",
    externalUrl: "drive.google.com/file/d/xyz",
  });
  assert.equal(res.status, 201);
  const id = (await json(res))?.id;
  createdResourceIds.push(id);

  const items = (await json(await api("/api/admin/resources")))?.items ?? [];
  const saved = items.find((r: any) => String(r._id) === id);
  assert.equal(saved.externalUrl, "https://drive.google.com/file/d/xyz");
});

test("a javascript: link is refused", async () => {
  const res = await post("/api/admin/resources", {
    title: "CG Test XSS",
    subject: "CG Testing",
    academicYear: 1,
    type: "pdf",
    externalUrl: "javascript://x.com/%0aalert(1)",
  });
  assert.equal(res.status, 400);
  assert.match(String((await json(res))?.error), /valid http/i);
});

test("an invalid resource type or year is rejected", async () => {
  const base = { title: "CG Test", subject: "CG Testing", externalUrl: "https://example.com" };
  assert.equal((await post("/api/admin/resources", { ...base, academicYear: 1, type: "gif" })).status, 400);
  assert.equal((await post("/api/admin/resources", { ...base, academicYear: 7, type: "pdf" })).status, 400);
});

test("a resource can be edited, and the URL is normalized on edit too", async () => {
  const res = await patch(`/api/admin/resources/${createdResourceIds[0]}`, {
    title: `CG Test Renamed ${stamp}`,
    externalUrl: "example.org/updated",
  });
  assert.equal(res.status, 200);

  const items = (await json(await api("/api/admin/resources")))?.items ?? [];
  const saved = items.find((r: any) => String(r._id) === createdResourceIds[0]);
  assert.equal(saved.title, `CG Test Renamed ${stamp}`);
  assert.equal(saved.externalUrl, "https://example.org/updated");
});

test("an empty resource PATCH is a 400, and a bad id is a 400 not a 500", async () => {
  assert.equal((await patch(`/api/admin/resources/${createdResourceIds[0]}`, {})).status, 400);
  assert.equal((await patch("/api/admin/resources/not-an-id", { title: "x" })).status, 400);
  assert.equal((await api("/api/admin/resources/not-an-id", { method: "DELETE" })).status, 400);
});

test("deleting a missing resource is 404", async () => {
  const res = await api("/api/admin/resources/0123456789abcdef01234567", { method: "DELETE" });
  assert.equal(res.status, 404);
});

test("a published resource reaches students with a usable link", async () => {
  const items = (await json(await api("/api/student/resources?subject=CG%20Testing")))?.items ?? [];
  const mine = items.find((r: any) => r.id === createdResourceIds[0]);
  assert.ok(mine, "the new resource should be visible to students");
  assert.match(mine.externalUrl, /^https:\/\//);
});

test("an admin may also use the student APIs", async () => {
  assert.equal((await api("/api/student/events")).status, 200);
  assert.equal((await api("/api/student/midterms")).status, 200);
});

test("admin pages render for an admin", async () => {
  for (const path of [
    "/admin",
    "/admin/rooms",
    "/admin/resources",
    "/admin/users",
    "/admin/verification",
    "/admin/activity",
  ]) {
    assert.equal((await api(path)).status, 200, `${path} should render`);
  }
});

// ------------------------------------------------------------- folder tree
//
// Covers the drive structure only. Uploads are not exercised here because they
// need real Cloudflare R2 credentials; link resources stand in for files.

test("folders nest, and the stored path reflects the tree", async () => {
  const root = await post("/api/admin/folders", { name: ROOT_FOLDER, parentId: null });
  assert.equal(root.status, 201);
  const rootFolder = (await json(root))?.folder;
  createdFolderIds.push(rootFolder.id);
  assert.equal(rootFolder.path, `/${ROOT_FOLDER}`);

  const child = await post("/api/admin/folders", { name: "Programming", parentId: rootFolder.id });
  assert.equal(child.status, 201);
  const childFolder = (await json(child))?.folder;
  createdFolderIds.push(childFolder.id);
  assert.equal(childFolder.path, `/${ROOT_FOLDER}/Programming`);

  const leaf = await post("/api/admin/folders", { name: "Lectures", parentId: childFolder.id });
  const leafFolder = (await json(leaf))?.folder;
  createdFolderIds.push(leafFolder.id);
  assert.equal(leafFolder.path, `/${ROOT_FOLDER}/Programming/Lectures`);
});

test("two folders cannot share a name in the same parent", async () => {
  const res = await post("/api/admin/folders", { name: ROOT_FOLDER, parentId: null });
  assert.equal(res.status, 409);
  assert.match(String((await json(res))?.error), /already exists/i);
});

test("renaming a folder rewrites the paths of everything beneath it", async () => {
  const renamed = `${ROOT_FOLDER} Renamed`;
  const res = await patch(`/api/admin/folders/${createdFolderIds[0]}`, { name: renamed });
  assert.equal(res.status, 200);

  const all = (await json(await api("/api/admin/folders")))?.folders ?? [];
  const leaf = all.find((f: any) => f.id === createdFolderIds[2]);
  assert.equal(leaf.path, `/${renamed}/Programming/Lectures`);
});

test("a folder cannot be moved inside itself or its own subtree", async () => {
  const intoSelf = await patch(`/api/admin/folders/${createdFolderIds[0]}`, { parentId: createdFolderIds[0] });
  assert.equal(intoSelf.status, 400);

  const intoChild = await patch(`/api/admin/folders/${createdFolderIds[0]}`, { parentId: createdFolderIds[2] });
  assert.equal(intoChild.status, 400);
  assert.match(String((await json(intoChild))?.error), /subfolder/i);
});

test("browsing a folder returns its subfolders and its own resources", async () => {
  const created = await post("/api/admin/resources", {
    kind: "link",
    title: `CG Test In Folder ${stamp}`,
    subject: "CG Testing",
    externalUrl: "https://example.com/in-folder",
    folderId: createdFolderIds[2],
  });
  assert.equal(created.status, 201);
  createdResourceIds.push((await json(created))?.id);

  const leaf = await json(await api(`/api/admin/drive?folderId=${createdFolderIds[2]}`));
  assert.equal(leaf.files.length, 1);
  assert.equal(leaf.breadcrumbs.length, 2, "breadcrumbs should list both ancestors");

  const middle = await json(await api(`/api/admin/drive?folderId=${createdFolderIds[1]}`));
  assert.equal(middle.folders.length, 1);
  assert.equal(middle.files.length, 0, "a resource belongs to its own folder, not the parent");
});

test("a resource can be moved between folders", async () => {
  const res = await patch(`/api/admin/resources/${createdResourceIds.at(-1)}`, {
    folderId: createdFolderIds[1],
  });
  assert.equal(res.status, 200);

  const middle = await json(await api(`/api/admin/drive?folderId=${createdFolderIds[1]}`));
  assert.equal(middle.files.length, 1);
});

test("a folder name containing a separator is rejected", async () => {
  for (const name of ["Year 1/Programming", "Year 1\\Programming"]) {
    const res = await post("/api/admin/folders", { name, parentId: null });
    assert.equal(res.status, 400, `"${name}" would make the display path ambiguous`);
    assert.match(String((await json(res))?.error), /slash/i);
  }
});

test("a folder can be moved back out to the root", async () => {
  const created = await post("/api/admin/folders", { name: `CG Movable ${stamp}`, parentId: createdFolderIds[0] });
  assert.equal(created.status, 201);
  const movable = (await json(created))?.folder;
  createdFolderIds.push(movable.id);

  const moved = await patch(`/api/admin/folders/${movable.id}`, { parentId: "root" });
  assert.equal(moved.status, 200);
  assert.equal((await json(moved))?.folder.path, `/CG Movable ${stamp}`);

  // Put the tree back the way the remaining tests expect to find it.
  assert.equal((await api(`/api/admin/folders/${movable.id}`, { method: "DELETE" })).status, 200);
  createdFolderIds.pop();
});

test("the student drive shows the same tree, read-only", async () => {
  // Admins may call the student APIs, so this exercises the student endpoint
  // without needing a second signed-in session.
  const res = await api(`/api/student/resources?folderId=${createdFolderIds[1]}`);
  assert.equal(res.status, 200);

  const body = await json(res);
  assert.equal(body.mode, "browse");
  assert.equal(body.folder.id, createdFolderIds[1]);
  assert.equal(body.breadcrumbs.length, 1, "one ancestor above this folder");
  assert.equal(body.folders.length, 1, "the Lectures subfolder");
  assert.equal(body.items.length, 1, "the resource moved here earlier");
});

test("a student drive request for a bad folder is a 404, not a crash", async () => {
  assert.equal((await api("/api/student/resources?folderId=not-an-id")).status, 404);
  assert.equal((await api("/api/student/resources?folderId=0123456789abcdef01234567")).status, 404);
});

test("searching switches away from folder browsing and finds the file anywhere", async () => {
  const res = await api(`/api/student/resources?q=${encodeURIComponent(`CG Test In Folder ${stamp}`)}`);
  assert.equal(res.status, 200);

  const body = await json(res);
  assert.equal(body.mode, "search");
  assert.equal(body.folder, null, "search spans the whole drive, so there is no current folder");
  assert.ok(
    body.items.some((i: any) => i.title === `CG Test In Folder ${stamp}`),
    "a file nested three folders deep should still be findable by name"
  );
});

// ------------------------------------------------------------- uploads
//
// A real upload needs Cloudflare credentials, so these cover the parts that run
// before R2 is ever contacted, plus the two legitimate outcomes of asking for a
// presigned URL. What they rule out is a 500 in either configuration.

test("an oversized upload is refused before any presigned URL is issued", async () => {
  const res = await post("/api/admin/resources/upload-url", {
    fileName: "huge.pdf",
    contentType: "application/pdf",
    size: 500 * 1024 * 1024,
  });

  assert.equal(res.status, 413);
  assert.match(String((await json(res))?.error), /too large/i);
});

test("an upload request without a file name is a 400", async () => {
  assert.equal((await post("/api/admin/resources/upload-url", { contentType: "application/pdf" })).status, 400);
  assert.equal((await post("/api/admin/resources/upload-url", { fileName: "" })).status, 400);
});

test("asking for an upload URL either signs one or explains that storage is unconfigured", async () => {
  const res = await post("/api/admin/resources/upload-url", {
    fileName: "notes.pdf",
    contentType: "application/pdf",
    size: 1024,
  });
  const body = await json(res);

  if (res.status === 200) {
    assert.match(String(body.key), /^resources\/[0-9a-f-]{36}\/notes\.pdf$/);
    assert.match(String(body.uploadUrl), /^https:\/\//);
    assert.ok(body.expiresIn > 0);
  } else {
    assert.equal(res.status, 503, `expected a signed URL or a 503, got ${res.status}`);
    assert.match(String(body.error), /R2/i);
  }
});

test("a file resource pointing at a nonexistent object is refused", async () => {
  const res = await post("/api/admin/resources", {
    kind: "file",
    title: "CG Test Phantom",
    objectKey: "resources/00000000-0000-4000-8000-000000000000/ghost.pdf",
    folderId: createdFolderIds[1],
  });

  // 400 when storage is configured and the HEAD misses; 503 when it isn't.
  assert.ok([400, 503].includes(res.status), `expected 400 or 503, got ${res.status}`);
  assert.ok(!(await json(res))?.id, "no resource row should be created for an upload that never landed");
});

test("a resource cannot be created as a file without an object key", async () => {
  const res = await post("/api/admin/resources", { kind: "file", title: "CG Test No Key" });
  assert.equal(res.status, 400);
});

test("deleting a folder removes its whole subtree", async () => {
  const res = await api(`/api/admin/folders/${createdFolderIds[0]}`, { method: "DELETE" });
  assert.equal(res.status, 200);
  assert.equal((await json(res))?.deletedFolders, 3);

  const all = (await json(await api("/api/admin/folders")))?.folders ?? [];
  for (const id of createdFolderIds) {
    assert.ok(!all.some((f: any) => f.id === id), "no folder in the deleted subtree should survive");
  }
});

// ------------------------------------------- accounts, verification, logs

/** A second signed-in browser, so a ban can be observed from the victim's side. */
async function signInAs(email: string, password: string) {
  const localJar = new Map<string, string>();

  const call = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    const cookies = Array.from(localJar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookies) headers.set("cookie", cookies);

    const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      if (idx <= 0) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (value) localJar.set(name, value);
      else localJar.delete(name);
    }
    return res;
  };

  const { csrfToken } = await (await call("/api/auth/csrf")).json();
  await call("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE}/dashboard`, json: "true" }),
  });

  return call;
}

test("a pending registration shows up in the verification queue", async () => {
  const db = mongoose.connection.db!;
  await db.collection("users").insertOne({
    email: VICTIM_EMAIL,
    miuId: VICTIM_MIU_ID,
    phone: "+201099999999",
    name: "CG Victim",
    passwordHash: await bcrypt.hash(VICTIM_PASSWORD, 10),
    role: "student",
    academicYear: 1,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const items = (await json(await api("/api/admin/users?status=pending")))?.items ?? [];
  const mine = items.find((u: any) => u.miuId === VICTIM_MIU_ID);
  assert.ok(mine, "a pending account belongs in the verification queue");
  assert.equal(mine.status, "pending");
  assert.equal(mine.phone, "+201099999999", "the phone is shown so it can be matched to the WhatsApp message");

  victimId = mine.id;
});

test("verifying an account activates it and records who did it", async () => {
  const res = await patch(`/api/admin/users/${victimId}`, { action: "verify" });
  assert.equal(res.status, 200);
  assert.equal((await json(res))?.user.status, "active");

  const detail = await json(await api(`/api/admin/users/${victimId}`));
  assert.ok(detail.user.verifiedAt, "the approval time should be stored");
  assert.ok(
    detail.logs.some((l: any) => l.action === "admin.user.verify"),
    "the account's own log should show the approval"
  );
});

test("a banned student loses access on their very next request", async () => {
  const asVictim = await signInAs(VICTIM_EMAIL, VICTIM_PASSWORD);
  assert.equal((await asVictim("/api/student/events")).status, 200, "verified students can read their data");

  const banned = await patch(`/api/admin/users/${victimId}`, { action: "ban", reason: "CG test ban" });
  assert.equal(banned.status, 200);

  // No sleep: the ban clears this account's cached state as part of the write.
  assert.equal(
    (await asVictim("/api/student/events")).status,
    401,
    "the existing session must stop working immediately, not when the JWT expires"
  );
});

test("unbanning restores a previously verified account", async () => {
  const res = await patch(`/api/admin/users/${victimId}`, { action: "unban" });
  assert.equal(res.status, 200);
  assert.equal((await json(res))?.user.status, "active", "they were verified before the ban");
});

test("an admin cannot ban or delete themselves", async () => {
  const me = (await json(await api(`/api/admin/users?q=${encodeURIComponent(EMAIL)}`)))?.items?.[0];
  assert.ok(me, "the signed-in admin should be searchable");

  assert.equal((await patch(`/api/admin/users/${me.id}`, { action: "ban" })).status, 400);
  assert.equal((await api(`/api/admin/users/${me.id}`, { method: "DELETE" })).status, 400);
});

test("account search matches on ID, email and phone", async () => {
  for (const term of [VICTIM_MIU_ID, VICTIM_EMAIL, "201099999999"]) {
    const items = (await json(await api(`/api/admin/users?q=${encodeURIComponent(term)}`)))?.items ?? [];
    assert.ok(
      items.some((u: any) => u.id === victimId),
      `searching "${term}" should find the account`
    );
  }
});

test("the stats endpoint reports active users and pending counts", async () => {
  const stats = await json(await api("/api/admin/stats"));

  for (const key of ["daily", "weekly", "monthly"]) {
    assert.equal(typeof stats.activeUsers[key], "number", `${key} active users should be a number`);
  }
  assert.ok(stats.activeUsers.monthly >= stats.activeUsers.daily, "monthly actives include daily ones");
  assert.ok(stats.users.total >= 1);
  assert.ok(Array.isArray(stats.signupSeries));
});

test("the activity feed records admin actions and can be filtered to one account", async () => {
  const all = (await json(await api("/api/admin/activity?limit=50")))?.items ?? [];
  assert.ok(all.length > 0, "verifying and banning should have been logged");

  const mine = (await json(await api(`/api/admin/activity?userId=${victimId}`)))?.items ?? [];
  assert.ok(mine.length > 0);
  assert.ok(
    mine.every((l: any) => l.actorId === victimId || l.targetId === victimId),
    "a filtered feed must only contain that account's entries"
  );
  assert.ok(mine.some((l: any) => l.action === "admin.user.ban"));
});

test("a bad user id is a 400 and a missing one a 404", async () => {
  assert.equal((await api("/api/admin/users/not-an-id")).status, 400);
  assert.equal((await api("/api/admin/users/0123456789abcdef01234567")).status, 404);
  assert.equal((await patch("/api/admin/users/not-an-id", { action: "ban" })).status, 400);
  assert.equal((await patch(`/api/admin/users/${victimId}`, { action: "explode" })).status, 400);
});

test("deleting an account removes it and its personal data", async () => {
  const res = await api(`/api/admin/users/${victimId}`, { method: "DELETE" });
  assert.equal(res.status, 200);

  assert.equal((await api(`/api/admin/users/${victimId}`)).status, 404);

  // The audit trail deliberately outlives the account.
  const logs = (await json(await api(`/api/admin/activity?userId=${victimId}`)))?.items ?? [];
  assert.ok(
    logs.some((l: any) => l.action === "admin.user.delete"),
    "the record of the deletion must survive the deletion"
  );
});

test("every admin page renders the shared sidebar shell", async () => {
  // The rail lives in the admin layout, so a routing mistake that drops the
  // layout would still return 200 — this checks the shell is actually there.
  const html = await (await api("/admin/users")).text();

  for (const href of [
    "/admin/verification",
    "/admin/users",
    "/admin/activity",
    "/admin/resources",
    "/admin/rooms",
  ]) {
    assert.ok(html.includes(`href="${href}"`), `the sidebar should link to ${href}`);
  }
});

test("the admin console drops the site navbar and footer", async () => {
  const adminHtml = await (await api("/admin")).text();

  assert.ok(!adminHtml.includes("<footer"), "the site footer should not render inside the admin console");
  assert.ok(
    !adminHtml.includes('aria-label="Open menu"'),
    "the site navbar should not render inside the admin console"
  );
  assert.ok(adminHtml.includes("Admin console"), "the sidebar shell should be present instead");
});

test("student pages keep the navbar and footer", async () => {
  // Suppressing the chrome is scoped to /admin — a regression here would strip
  // navigation from the whole site.
  const html = await (await api("/dashboard")).text();

  assert.ok(html.includes("<footer"), "the footer should still render outside the admin area");
  assert.ok(html.includes('aria-label="Open menu"'), "the navbar should still render outside the admin area");
});

// ------------------------------------------------------------------ cleanup

after(async () => {
  const db = mongoose.connection.db!;
  for (const id of createdFolderIds) {
    await db.collection("folders").deleteOne({ _id: new mongoose.Types.ObjectId(id) });
  }
  for (const id of createdRoomIds) {
    await db.collection("rooms").deleteOne({ _id: new mongoose.Types.ObjectId(id) });
  }
  await db.collection("rooms").deleteMany({ roomCode: { $in: [ROOM_CODE, `${ROOM_CODE}B`] } });
  for (const id of createdResourceIds) {
    await db.collection("resources").deleteOne({ _id: new mongoose.Types.ObjectId(id) });
  }
  await db.collection("resources").deleteMany({ subject: "CG Testing" });
  await db.collection("users").deleteMany({ email: { $in: [EMAIL, VICTIM_EMAIL] } });
  await db.collection("activitylogs").deleteMany({ targetLabel: { $in: [VICTIM_MIU_ID, VICTIM_EMAIL] } });
  await mongoose.disconnect();
});
