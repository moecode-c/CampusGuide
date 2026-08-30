import path from "node:path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Room } from "../src/server/models/Room";
import { invalidateRoomsCache } from "../src/server/data/rooms";
import { ensureSrvDns } from "../src/server/dns";

type SeedRoom = {
  roomCode: string;
  building: string;
  floor: number;
  x: number;
  y: number;
};

type Position = { x: number; y: number };

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function range(start: number, end: number) {
  const out: number[] = [];
  for (let n = start; n <= end; n++) out.push(n);
  return out;
}

function pushRoom(
  out: SeedRoom[],
  roomCode: string,
  building: string,
  floor: number,
  pos: Position
) {
  out.push({
    roomCode: roomCode.trim().toUpperCase(),
    building: building.trim().toUpperCase(),
    floor,
    x: clamp01(pos.x),
    y: clamp01(pos.y),
  });
}

function buildSeed() {
  // Provided positions (normalized 0..1)
  const RIGHTMAIN: Position = { x: 0.579, y: 0.981 };
  const LEFTMAIN: Position = { x: 0.368, y: 0.878 };
  const UPPERN: Position = { x: 0.341, y: 0.318 };
  const LOWERN: Position = { x: 0.344, y: 0.463 };
  const MIDDLEN: Position = { x: 0.344, y: 0.384 };

  const NBRIDGES: Position = { x: 0.431, y: 0.321 };
  const SMIDDLE: Position = { x: 0.513, y: 0.381 };
  const DOWNR: Position = { x: 0.636, y: 0.234 };
  const TOPR: Position = { x: 0.641, y: 0.067 };
  const MIDDLER: Position = { x: 0.641, y: 0.138 };
  const KBUILD: Position = { x: 0.655, y: 0.831 };

  const seed: SeedRoom[] = [];

  // MAIN building
  const MAIN = "MAIN";

  // RIGHTMAIN: 227-235 (floor 2) and 327-335 (floor 3)
  for (const n of range(227, 235)) pushRoom(seed, String(n), MAIN, 2, RIGHTMAIN);
  for (const n of range(327, 335)) pushRoom(seed, String(n), MAIN, 3, RIGHTMAIN);

  // LEFTMAIN: 201-226 (floor 2) and 301-326 (floor 3)
  for (const n of range(201, 226)) pushRoom(seed, String(n), MAIN, 2, LEFTMAIN);
  for (const n of range(301, 326)) pushRoom(seed, String(n), MAIN, 3, LEFTMAIN);

  // N building zones
  const N = "N";

  // UPPERN
  pushRoom(seed, "NA6", N, 1, UPPERN);
  pushRoom(seed, "NB1", N, 2, UPPERN);
  pushRoom(seed, "NC1", N, 3, UPPERN);
  pushRoom(seed, "ND2", N, 4, UPPERN);

  // LOWERN
  pushRoom(seed, "NA1", N, 1, LOWERN);
  pushRoom(seed, "NB2", N, 2, LOWERN);
  pushRoom(seed, "NC2", N, 3, LOWERN);
  // Note: ND2 appears twice in the provided requirements; the later entry will overwrite.
  pushRoom(seed, "ND2", N, 4, LOWERN);

  // MIDDLE N
  for (const code of ["NA2", "NA3", "NA4", "NA5"]) pushRoom(seed, code, N, 1, MIDDLEN);
  for (const n of range(1, 14)) pushRoom(seed, `N${n}`, N, 2, MIDDLEN);
  for (const n of range(15, 28)) pushRoom(seed, `N${n}`, N, 3, MIDDLEN);
  for (const n of range(29, 42)) pushRoom(seed, `N${n}`, N, 4, MIDDLEN);

  // NBRIDGES
  for (const n of range(61, 66)) pushRoom(seed, `N${n}`, N, 3, NBRIDGES);
  for (const n of range(67, 75)) pushRoom(seed, `N${n}`, N, 4, NBRIDGES);

  // S building (middle)
  const S = "S";
  for (const n of range(1, 8)) pushRoom(seed, `S${n}`, S, 1, SMIDDLE);
  for (const n of range(9, 22)) pushRoom(seed, `S${n}`, S, 2, SMIDDLE);
  for (const n of range(24, 39)) pushRoom(seed, `S${n}`, S, 3, SMIDDLE);
  for (const n of range(41, 59)) pushRoom(seed, `S${n}`, S, 4, SMIDDLE);

  // R building
  const R = "R";

  // DOWNR
  pushRoom(seed, "PH1", R, 1, DOWNR);
  for (const n of range(1, 3)) pushRoom(seed, `RB${n}`, R, 2, DOWNR);
  for (const n of range(1, 3)) pushRoom(seed, `RC${n}`, R, 3, DOWNR);
  for (const n of range(1, 3)) pushRoom(seed, `RD${n}`, R, 4, DOWNR);
  for (const n of range(1, 2)) pushRoom(seed, `RE${n}`, R, 5, DOWNR);
  pushRoom(seed, "RE9", R, 5, DOWNR);

  // TOPR
  for (const n of range(1, 3)) pushRoom(seed, `RA${n}`, R, 1, TOPR);
  for (const n of range(4, 6)) pushRoom(seed, `RB${n}`, R, 2, TOPR);
  for (const n of range(4, 11)) pushRoom(seed, `RC${n}`, R, 3, TOPR);
  for (const n of range(4, 11)) pushRoom(seed, `RD${n}`, R, 4, TOPR);
  for (const n of range(6, 8)) pushRoom(seed, `RE${n}`, R, 5, TOPR);

  // MIDDLER
  for (const n of range(3, 5)) pushRoom(seed, `RE${n}`, R, 5, MIDDLER);

  // K building
  pushRoom(seed, "LABK", "K", 1, KBUILD);

  // Deduplicate by roomCode (Room.roomCode is globally unique)
  const byCode = new Map<string, SeedRoom>();
  for (const r of seed) {
    const existing = byCode.get(r.roomCode);
    if (existing) {
      console.warn(
        `Duplicate roomCode ${r.roomCode}; overwriting ${existing.building}/F${existing.floor} -> ${r.building}/F${r.floor}`
      );
    }
    byCode.set(r.roomCode, r);
  }

  return [...byCode.values()];
}

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Put it in .env.local or your environment.");
  }

  const seed = buildSeed();

  // Atlas SRV URIs need a resolver that answers SRV/TXT; add public fallbacks
  // when the system one refuses. No-op for a plain mongodb:// host.
  ensureSrvDns(uri);

  await mongoose.connect(uri, {
    dbName: "campusguide",
    // Generous compared with localhost: this may be a remote Atlas cluster
    // doing a cold TLS handshake.
    serverSelectionTimeoutMS: 30_000,
    connectTimeoutMS: 30_000,
    socketTimeoutMS: 45_000,
  });

  // Start fresh every time (per request).
  // Prefer dropping the collection to reset indexes quickly; fall back to deleteMany.
  try {
    await Room.collection.drop();
  } catch (err: any) {
    // NamespaceNotFound means the collection doesn't exist yet.
    if (err?.codeName !== "NamespaceNotFound") {
      await Room.deleteMany({});
    }
  }

  await Room.insertMany(seed, { ordered: true });

  // Dropping the collection above also dropped its indexes, including the unique
  // one on roomCode. Mongoose's own index build races that drop, so whether they
  // come back is down to timing — rebuild them explicitly. Without the unique
  // index the admin UI silently stops rejecting duplicate room codes.
  await Room.syncIndexes();

  invalidateRoomsCache();

  console.log(`Seeded ${seed.length} rooms (zones) after clearing collection.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
