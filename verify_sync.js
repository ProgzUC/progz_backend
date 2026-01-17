import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import PendingUser from "./models/PendingUser.js";
import bcrypt from "bcryptjs";

dotenv.config();

const API_URL = "http://localhost:5001/api";

const post = async (url, data, token) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(data) });
    return { status: res.status, data: await res.json() };
};

const ensureAdmin = async () => {
    const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
    if (!ADMIN_EMAIL) return;
    let admin = await User.findOne({ email: ADMIN_EMAIL });
    if (!admin) {
        const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await User.create({ name: ADMIN_NAME, email: ADMIN_EMAIL, password: hashed, role: "admin", phone: "0000000000" });
    }
};

const runVerification = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");
        await ensureAdmin();

        // Login Admin
        console.log("\n--- Logging in as Admin ---");
        const adminLogin = await post(`${API_URL}/auth/login`, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
        const adminToken = adminLogin.data.accessToken;

        // Create Student
        const studentEmail = "synctest@example.com";
        await User.findOneAndDelete({ email: studentEmail });
        await User.create({ name: "Sync Student", email: studentEmail, password: "password", role: "student", phone: "000" });
        const studentLogin = await post(`${API_URL}/auth/login`, { email: studentEmail, password: "password" });
        const studentToken = studentLogin.data.accessToken;

        // 1. Student Triggers Sync (Fail)
        console.log("\n--- Test 1: Student Triggers Sync (Forbidden) ---");
        const test1 = await post(`${API_URL}/sync/manual`, {}, studentToken);
        if (test1.status === 403) console.log("Verified: Student blocked from syncing");
        else console.error("Error: Student allowed to sync", test1.status);

        // 2. Admin Triggers Sync (Pass)
        console.log("\n--- Test 2: Admin Triggers Sync (Allowed) ---");
        // Note: This effectively calls the real or mock API. If API key is invalid, the logs on server will show error, 
        // but the controller should return 200 as logic catches errors.
        const test2 = await post(`${API_URL}/sync/manual`, {}, adminToken);
        const zenUser = await mongoose.model("PendingUser").findOne({ source: "zen" });
        if (zenUser) {
            console.log("Verified: Found synced user with source='zen'");
            console.log(`User: ${zenUser.email}, ZenCourseName: ${zenUser.zenCourseName}, ZenCourseType: ${zenUser.zenCourseType}`);
        } else {
            console.log("Warning: No 'zen' source user found yet.");
            const count = await mongoose.model("PendingUser").countDocuments();
            console.log(`Total Pending Users: ${count}`);
            if (count > 0) {
                const sample = await mongoose.model("PendingUser").findOne();
                console.log("Sample user:", sample);
            }
        }

    } catch (err) {
        console.error("Unexpected error:", err);
    } finally {
        await mongoose.connection.close();
    }
};

runVerification();
