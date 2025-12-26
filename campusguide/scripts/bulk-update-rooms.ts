
import { config } from "dotenv";
config({ path: ".env.local" });

import { connectToDatabase } from "../src/server/db";
import { Room } from "../src/server/models/Room";
import mongoose from "mongoose";

async function main() {
    await connectToDatabase();
    console.log("Connected to DB.");

    const TARGET_X = 0.377;
    const TARGET_Y = 0.921;
    const ranges = [
        { start: 100, end: 130 },
        { start: 200, end: 230 },
        { start: 300, end: 330 },
    ];

    console.log(`Starting bulk update to x=${TARGET_X}, y=${TARGET_Y} for ranges:`, ranges);

    // Fetch all rooms first to filter safely in JS
    const allRooms = await Room.find({});
    let updatedCount = 0;

    for (const room of allRooms) {
        const codeNum = parseInt(room.roomCode, 10);
        if (!isNaN(codeNum)) {
            let match = false;
            for (const r of ranges) {
                if (codeNum >= r.start && codeNum <= r.end) {
                    match = true;
                    break;
                }
            }

            if (match) {
                // Update
                room.x = TARGET_X;
                room.y = TARGET_Y;
                await room.save();
                console.log(`Updated Room ${room.roomCode}`);
                updatedCount++;
            }
        }
    }

    console.log(`Complete. Updated ${updatedCount} rooms.`);
    await mongoose.disconnect();
}

main().catch(console.error);
