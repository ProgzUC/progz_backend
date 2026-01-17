import mongoose from "mongoose";
import dotenv from "dotenv";
import PendingUser from "./models/PendingUser.js";
import User from "./models/User.js";
import bcrypt from "bcryptjs";

dotenv.config();

const API_URL = "http://localhost:5000/api";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper for fetch
const post = async (url, data, token) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
    });
    return { status: res.status, data: await res.json() };
};

const get = async (url, token) => {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    return { status: res.status, data: await res.json() };
};

const del = async (url, token) => {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { method: "DELETE", headers });
    return { status: res.status, data: await res.json() };
};

const ensureAdmin = async () => {
    const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
    if (!ADMIN_EMAIL) return;

    let admin = await User.findOne({ email: ADMIN_EMAIL });
    if (!admin) {
        console.log("Creating admin user...");
        const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await User.create({
            name: ADMIN_NAME || "Admin",
            email: ADMIN_EMAIL,
            password: hashed,
            role: "admin",
            phone: "0000000000"
        });
    } else {
        console.log("Admin user exists.");
    }
};

const runVerification = async () => {
    try {
        // 1. Connect to DB to clean up before test
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        await ensureAdmin();

        const testEmail = "pending_test@example.com";
        const rejectEmail = "reject_test@example.com";

        // Clean up
        await PendingUser.deleteMany({ email: { $in: [testEmail, rejectEmail] } });
        await User.deleteMany({ email: { $in: [testEmail, rejectEmail] } });
        console.log("Cleaned up old test data");

        // 2. Register a new user
        console.log("\n--- Testing Registration ---");
        const regRes = await post(`${API_URL}/users/register`, {
            name: "Pending Tester",
            email: testEmail,
            password: "password123",
            phone: "1234567890",
            role: "student",
        });
        console.log("Registration status:", regRes.status, regRes.data.msg);

        // 3. Login as Admin
        console.log("\n--- Logging in as Admin ---");
        const loginRes = await post(`${API_URL}/auth/login`, {
            email: process.env.ADMIN_EMAIL,
            password: process.env.ADMIN_PASSWORD,
        });

        if (loginRes.status !== 200) {
            console.error("Admin login failed:", loginRes.data);
            process.exit(1);
        }
        const adminToken = loginRes.data.accessToken;
        console.log("Admin logged in");

        // 4. Get Pending Users
        console.log("\n--- Fetching Pending Users ---");
        let pendingUserId;
        const pendingRes = await get(`${API_URL}/users/pending`, adminToken);
        console.log(`Found ${pendingRes.data.length} pending users`);

        const found = pendingRes.data.find((u) => u.email === testEmail);
        if (found) {
            console.log("Found our test user in pending list");
            pendingUserId = found._id;
        } else {
            console.error("Test user not found in pending list!");
        }

        // 5. Approve User
        if (pendingUserId) {
            console.log("\n--- Approving User ---");
            const approveRes = await post(`${API_URL}/users/approve/${pendingUserId}`, {}, adminToken);
            console.log("Approve response:", approveRes.data.msg);

            // Verify moved to User
            const userCheck = await User.findOne({ email: testEmail });
            if (userCheck) console.log("Verified: User exists in main collection");
            else console.error("Error: User not found in main collection after approval");

            const pendingCheck = await PendingUser.findOne({ email: testEmail });
            if (!pendingCheck) console.log("Verified: User removed from pending collection");
            else console.error("Error: User still in pending collection");
        }

        // 6. Test Rejection
        console.log("\n--- Testing Rejection ---");
        // Register reject user
        await post(`${API_URL}/users/register`, {
            name: "Reject Tester",
            email: rejectEmail,
            password: "password123",
            phone: "0987654321",
            role: "trainer",
        });

        // Get ID
        const pendingRes2 = await get(`${API_URL}/users/pending`, adminToken);
        const rejectPendingUser = pendingRes2.data.find((u) => u.email === rejectEmail);

        if (rejectPendingUser) {
            const rejectRes = await del(`${API_URL}/users/pending/${rejectPendingUser._id}`, adminToken);
            console.log("Reject response:", rejectRes.data.msg);

            const rejectCheck = await PendingUser.findOne({ email: rejectEmail });
            if (!rejectCheck) console.log("Verified: User removed from pending collection");
            else console.error("Error: User still in pending collection");
        }

    } catch (err) {
        console.error("Unexpected error:", err);
    } finally {
        await mongoose.connection.close();
    }
};

runVerification();
