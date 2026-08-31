/**
 * Room codes on a student's schedule are typed by hand; these cover the
 * spellings that used to leave a class with no pin on the map.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { findRoomByCode, indexRoomsByCode, matchScheduleRooms, roomCodeKey } from "../src/lib/rooms";

const ROOMS = [
  { roomCode: "204" },
  { roomCode: "RC1" },
  { roomCode: "NA6" },
  { roomCode: "LABK" },
];

test("the comparison key keeps only letters and digits", () => {
  assert.equal(roomCodeKey("rc-1"), "RC1");
  assert.equal(roomCodeKey(" RC 1 "), "RC1");
  assert.equal(roomCodeKey("Room_204"), "ROOM204");
  assert.equal(roomCodeKey(""), "");
  assert.equal(roomCodeKey(null), "");
});

test("a room is found however the student spelled the code", () => {
  for (const written of ["RC1", "rc1", "RC-1", "rc 1", " Rc1 "]) {
    assert.equal(findRoomByCode(ROOMS, written)?.roomCode, "RC1", `"${written}" should find RC1`);
  }
});

test("codes that only look similar are still kept apart", () => {
  assert.equal(findRoomByCode(ROOMS, "R204"), null, "R204 is not room 204");
  assert.equal(findRoomByCode(ROOMS, "2040"), null);
  assert.equal(findRoomByCode(ROOMS, "RC10"), null, "RC10 is not RC1");
});

test("an empty code matches nothing rather than the first room", () => {
  assert.equal(findRoomByCode(ROOMS, ""), null);
  assert.equal(findRoomByCode(ROOMS, "   "), null);
  assert.equal(findRoomByCode(ROOMS, undefined), null);
});

test("an exact code is not shadowed by a later near-duplicate", () => {
  const index = indexRoomsByCode([{ roomCode: "RC1" }, { roomCode: "R-C1" }]);
  assert.equal(index.get("RC1")?.roomCode, "RC1");
});

test("a schedule splits into rooms the map can place and codes it cannot", () => {
  const { placed, unknown } = matchScheduleRooms(ROOMS, ["rc-1", "204", "C204", "ZZ9"]);
  assert.deepEqual(placed.map((r) => r.roomCode), ["RC1", "204"]);
  assert.deepEqual(unknown, ["C204", "ZZ9"]);
});

test("the same room booked for several classes is pinned once", () => {
  const { placed } = matchScheduleRooms(ROOMS, ["RC1", "rc1", "RC-1"]);
  assert.equal(placed.length, 1);
});

test("an unknown code is reported once, in the shape the student typed", () => {
  const { unknown } = matchScheduleRooms(ROOMS, ["c204", "C204", " c204 "]);
  assert.deepEqual(unknown, ["C204"]);
});

test("blank codes are ignored instead of being reported as missing rooms", () => {
  const { placed, unknown } = matchScheduleRooms(ROOMS, ["", "   ", "RC1"]);
  assert.equal(placed.length, 1);
  assert.deepEqual(unknown, []);
});

test("a schedule the map fully covers reports nothing missing", () => {
  const { placed, unknown } = matchScheduleRooms(ROOMS, ["204", "NA6", "labk"]);
  assert.equal(placed.length, 3);
  assert.deepEqual(unknown, []);
});
