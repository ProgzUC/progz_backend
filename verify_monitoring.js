import mongoose from "mongoose";
import dotenv from "dotenv";
import AuditLog from "./models/AuditLog.js";
import ErrorLog from "./models/ErrorLog.js";
import SystemMetric from "./models/SystemMetric.js";

dotenv.config();

const runVerification = async () => {
    try {
        console.log("🔗 Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB Connected successfully.");

        // Clear any old verification-test entries
        console.log("🧹 Cleaning up old test logs...");
        await AuditLog.deleteMany({ action: "verification_test_action" });
        await ErrorLog.deleteMany({ message: "Verification Test Error" });

        // 1. Verify Audit Logs
        console.log("📝 Writing test audit log...");
        const audit = await AuditLog.create({
            userName: "Verification Script",
            userEmail: "verifier@progz.tech",
            userRole: "system",
            action: "verification_test_action",
            targetType: "System",
            details: { test: true }
        });
        console.log("✅ Audit Log written with ID:", audit._id);

        const fetchedAudit = await AuditLog.findOne({ action: "verification_test_action" });
        if (fetchedAudit && fetchedAudit.userName === "Verification Script") {
            console.log("✅ Audit Log queried and validated successfully.");
        } else {
            throw new Error("Audit Log verification failed.");
        }

        // 2. Verify Error Logs
        console.log("📝 Writing test error log...");
        const error = await ErrorLog.create({
            message: "Verification Test Error",
            stack: "Error: Verification Test Error\n    at runVerification (verify_monitoring.js:33)",
            method: "TEST",
            url: "/api/test/verify"
        });
        console.log("✅ Error Log written with ID:", error._id);

        const fetchedError = await ErrorLog.findOne({ message: "Verification Test Error" });
        if (fetchedError && fetchedError.method === "TEST") {
            console.log("✅ Error Log queried and validated successfully.");
        } else {
            throw new Error("Error Log verification failed.");
        }

        // 3. Verify System Metrics
        console.log("📝 Checking System Metrics collection...");
        const count = await SystemMetric.countDocuments();
        console.log(`✅ System Metrics collection has ${count} historical snapshot documents.`);

        // Clean up verification data
        console.log("🧹 Cleaning up verification entries...");
        await AuditLog.deleteMany({ action: "verification_test_action" });
        await ErrorLog.deleteMany({ message: "Verification Test Error" });
        
        console.log("\n🎉 ALL TELEMETRY MODELS VALIDATED SUCCESSFULLY! 🎉\n");
    } catch (err) {
        console.error("❌ Verification failed:", err);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log("🔌 MongoDB Connection closed.");
    }
};

runVerification();
