
import { config } from "dotenv";
config({ path: ".env.local" });

import { connectToDatabase } from "../src/server/db";
import { Room } from "../src/server/models/Room";
import mongoose from "mongoose";

async function main() {
    await connectToDatabase();

    const testCode = "TEST-API-" + Date.now();
    console.log("Creating room...");
    const created = await Room.create({
        roomCode: testCode,
        building: "API",
        floor: 1,
        x: 0.1,
        y: 0.1
    });

    console.log("Mocking API response...");
    const updated = await Room.findOneAndUpdate(
        { _id: created._id },
        { $set: { x: 0.9, y: 0.9 } },
        { new: true, runValidators: true }
    ).lean();

    if (!updated) {
        console.log("Failed to update");
        return;
    }

    console.log("Raw updated doc keys:", Object.keys(updated));
    // @ts-ignore
    console.log("Type of _id:", typeof updated._id);
    // @ts-ignore
    console.log("Constructor of _id:", updated._id?.constructor.name);

    const jsonString = JSON.stringify({ ok: true, item: updated });
    console.log("JSON Response Body:", jsonString);

    const parsed = JSON.parse(jsonString);
    console.log("Parsed item._id type:", typeof parsed.item._id);
    console.log("Parsed item._id value:", parsed.item._id);

    await Room.deleteOne({ _id: created._id });
    await mongoose.disconnect();
}

main().catch(console.error);
