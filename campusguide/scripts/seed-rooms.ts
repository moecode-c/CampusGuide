import path from "node:path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Room } from "../src/server/models/Room";
import { ensureSrvDns } from "../src/server/dns";
import { invalidateRoomsCache } from "../src/server/data/rooms";

type SeedRoom = {
  roomCode: string;
  building: string;
  floor: number;
  x: number;
  y: number;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mainBuildingRooms(): SeedRoom[] {
  const rooms: SeedRoom[] = [];
  const building = "MAIN";

  const addRange = (start: number, end: number, floor: number, y: number) => {
    const count = end - start;
    for (let n = start; n <= end; n++) {
      const t = count === 0 ? 0 : (n - start) / count;
      // MAIN building appears on the right side of the map image; keep rooms spread along it.
      const x = lerp(0.56, 0.70, t);
      rooms.push({ roomCode: String(n), building, floor, x: clamp01(x), y: clamp01(y) });
    }
  };

  // Spread floors slightly vertically so markers don’t fully overlap on a single image.
  addRange(100, 130, 1, 0.74);
  addRange(200, 230, 2, 0.71);
  addRange(300, 330, 3, 0.68);

  return rooms;
}

function rBuildingRooms(): SeedRoom[] {
  const rooms: SeedRoom[] = [];
  const building = "R";

  // R building sits toward the upper-right area on the current map image.
  const upperY = 0.30;
  const lowerY = 0.40;

  // PH1 — lower half of R building (assume ground floor)
  rooms.push({ roomCode: "PH1", building, floor: 0, x: 0.83, y: lowerY });

  // RA1–RA3 — ground floor upper half
  for (let i = 1; i <= 3; i++) {
    rooms.push({
      roomCode: `RA${i}`,
      building,
      floor: 0,
      x: clamp01(lerp(0.80, 0.88, (i - 1) / 2)),
      y: clamp01(upperY + (i - 2) * 0.01),
    });
  }

  const addBand = (
    prefix: string,
    floor: number,
    start: number,
    end: number,
    yBase: number,
    xStart: number,
    xEnd: number
  ) => {
    const count = end - start;
    for (let i = start; i <= end; i++) {
      const t = count === 0 ? 0 : (i - start) / count;
      rooms.push({
        roomCode: `${prefix}${i}`,
        building,
        floor,
        x: clamp01(lerp(xStart, xEnd, t)),
        y: clamp01(yBase + ((i % 2 === 0 ? 1 : -1) * 0.008)),
      });
    }
  };

  // RB — 2nd floor
  addBand("RB", 2, 1, 3, lowerY, 0.78, 0.84);
  addBand("RB", 2, 4, 9, upperY, 0.78, 0.90);

  // RC — 3rd floor
  addBand("RC", 3, 1, 3, lowerY, 0.78, 0.84);
  addBand("RC", 3, 4, 9, upperY, 0.78, 0.90);

  // RD — 4th floor
  addBand("RD", 4, 1, 3, lowerY, 0.78, 0.84);
  addBand("RD", 4, 4, 9, upperY, 0.78, 0.90);

  // RE — 5th floor
  addBand("RE", 5, 1, 3, lowerY, 0.78, 0.84);
  addBand("RE", 5, 4, 9, upperY, 0.78, 0.90);

  return rooms;
}

function kBuildingRooms(): SeedRoom[] {
  return [
    // Lab K — K building (floor not specified, assume 1)
    { roomCode: "LABK", building: "K", floor: 1, x: 0.22, y: 0.44 },
  ];
}

function buildSeed(): SeedRoom[] {
  return [...mainBuildingRooms(), ...kBuildingRooms(), ...rBuildingRooms()].map((r) => ({
    ...r,
    roomCode: r.roomCode.trim().toUpperCase(),
    building: r.building.trim().toUpperCase(),
    x: clamp01(r.x),
    y: clamp01(r.y),
  }));
}

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  const seed = buildSeed();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Put it in .env.local or your environment.");
  }

  ensureSrvDns(uri);

  await mongoose.connect(uri, {
    dbName: "campusguide",
    serverSelectionTimeoutMS: 30_000,
    connectTimeoutMS: 30_000,
    socketTimeoutMS: 45_000,
  });

  if (process.env.RESET_ROOMS === "1") {
    await Room.deleteMany({});
  }

  for (const r of seed) {
    await Room.updateOne({ roomCode: r.roomCode }, { $set: r }, { upsert: true });
  }

  invalidateRoomsCache();

  console.log(`Seeded/updated ${seed.length} rooms.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
