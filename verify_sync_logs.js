import mongoose from "mongoose";
import dotenv from "dotenv";
import { runCompleteSync } from "./services/syncService.js";
import SyncLog from "./models/SyncLog.js";

dotenv.config();

const runVerification = async () => {
    try {
        console.log("🔗 Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected.");

        console.log("🔄 Triggering complete master synchronization...");
        const log = await runCompleteSync("manual", null, null);
        
        console.log("✅ Sync Run Completed!");
        console.log("=========================================");
        console.log(`Log ID: ${log._id}`);
        console.log(`Status: ${log.status}`);
        console.log(`Instructors Synced: ${log.instructorsSynced}`);
        console.log(`Students Synced: ${log.studentsSynced}`);
        console.log(`Duplicates Detected: ${log.duplicatesDetected}`);
        console.log(`Execution Time: ${log.executionTimeMs}ms`);
        console.log(`Errors Logged: ${log.errors.length}`);
        if (log.errors.length > 0) {
            console.log("Sample Error:", log.errors[0]);
        }
        console.log("=========================================");

        // Fetch from DB to verify persistence
        const fetchedLog = await SyncLog.findById(log._id);
        if (fetchedLog) {
            console.log("🎉 SUCCESS: SyncLog successfully persisted in MongoDB!");
        } else {
            throw new Error("SyncLog failed to persist.");
        }

    } catch (err) {
        console.error("❌ Verification failed:", err.message);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log("🔌 MongoDB Connection closed.");
    }
};

runVerification();
