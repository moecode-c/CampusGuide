
import { config } from "dotenv";
config({ path: ".env.local" });

import { connectToDatabase } from "../src/server/db";
import { Room } from "../src/server/models/Room";
import mongoose from "mongoose";

async function main() {
    console.log("Connecting to DB...");
    await connectToDatabase();
    console.log("Connected.");

    const testCode = "TEST-ROOM-" + Date.now();

    console.log("Creating room...");
    const created = await Room.create({
        roomCode: testCode,
        building: "TEST",
        floor: 1,
        x: 0.1,
        y: 0.1
    });
    console.log("Created room:", created._id);

    console.log("Updating room x/y...");
    const updateRes = await Room.updateOne(
        { _id: created._id },
        { $set: { x: 0.5, y: 0.5 } }
    );
    console.log("Update result:", updateRes);

    const fetched = await Room.findById(created._id);
    console.log("Fetched room:", fetched?.toObject());

    if (fetched?.x === 0.5 && fetched?.y === 0.5) {
        console.log("SUCCESS: Room updated correctly.");
    } else {
        console.error("FAILURE: Room did not update correctly.");
    }

    console.log("Cleaning up...");
    await Room.deleteOne({ _id: created._id });

    await mongoose.disconnect();
}

main().catch(console.error);
