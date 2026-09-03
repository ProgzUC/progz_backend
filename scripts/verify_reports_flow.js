import mongoose from "mongoose";
import dotenv from "dotenv";
import { getOperationalSummary, getAttendanceAnalytics, getEnrollmentAnalytics, getTrainerUtilization, getBatchHealthReport } from "../controllers/reportController.js";
import connectDB from "../config/db.js";

dotenv.config();

const mockRes = {
    status: (code) => ({
        json: (data) => {
            console.log(`[Status ${code}] Response:`, data ? "OK (Data received)" : "No data");
            return data;
        },
        send: (data) => {
            console.log(`[Status ${code}] Send:`, "OK (Data received)");
            return data;
        }
    }),
    json: (data) => {
        console.log(`Response:`, data ? "OK (Data received)" : "No data");
        return data;
    },
    setHeader: () => {}
};

async function verifyReports() {
    try {
        await connectDB();
        console.log("Connected to MongoDB for Reports Verification\n");

        console.log("--- Testing Operational Summary ---");
        const operationalData = await getOperationalSummary({}, mockRes);
        console.log("Operational Summary passed.\n");

        console.log("--- Testing Attendance Analytics ---");
        const attendanceData = await getAttendanceAnalytics({ query: {} }, mockRes);
        console.log("Attendance Analytics passed.\n");

        console.log("--- Testing Enrollment Analytics ---");
        const enrollmentData = await getEnrollmentAnalytics({}, mockRes);
        console.log("Enrollment Analytics passed.\n");

        console.log("--- Testing Trainer Utilization ---");
        const trainerData = await getTrainerUtilization({}, mockRes);
        console.log("Trainer Utilization passed.\n");

        console.log("--- Testing Batch Health Report ---");
        const batchHealthData = await getBatchHealthReport({}, mockRes);
        console.log("Batch Health Report passed.\n");

    } catch (error) {
        console.error("Verification failed:", error);
    } finally {
        mongoose.connection.close();
        console.log("Disconnected from MongoDB");
    }
}

verifyReports();
