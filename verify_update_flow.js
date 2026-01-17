import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import bcrypt from "bcryptjs";

dotenv.config();

const API_URL = "http://localhost:5000/api";

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

const put = async (url, data, token) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(data),
    });
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
    }
};

const runVerification = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        await ensureAdmin();

        // Login Admin
        console.log("\n--- Logging in as Admin ---");
        const adminLogin = await post(`${API_URL}/auth/login`, {
            email: process.env.ADMIN_EMAIL,
            password: process.env.ADMIN_PASSWORD,
        });
        const adminToken = adminLogin.data.accessToken;
        console.log("Admin logged in");

        // Create Test Student
        const studentEmail = "updatetest@example.com";
        await User.findOneAndDelete({ email: studentEmail });

        // Create directly in DB
        const studentPassword = await bcrypt.hash("password", 10);
        const studentUser = await User.create({
            name: "Test Student",
            email: studentEmail,
            password: studentPassword,
            role: "student",
            phone: "1234567890",
            address: "Old Address"
        });
        const studentId = studentUser._id;
        console.log("Created test student:", studentId);

        // Login Student
        console.log("\n--- Logging in as Student ---");
        const studentLogin = await post(`${API_URL}/auth/login`, {
            email: studentEmail,
            password: "password"
        });
        const studentToken = studentLogin.data.accessToken;
        console.log("Student logged in");


        // 1. Student updates non-restricted field (Success)
        console.log("\n--- Test 1: Student updates Address (Allowed) ---");
        const update1 = await put(`${API_URL}/users/${studentId}`, {
            address: "New Address"
        }, studentToken);

        if (update1.status === 200 && update1.data.user.address === "New Address") {
            console.log("Verified: Student updated address successfully");
        } else {
            console.error("Error: Student update address failed", update1.data);
        }

        // 2. Student updates Name (Should Fail/Ignore)
        // Our implementation returns 403 if restricted field is attempted
        console.log("\n--- Test 2: Student updates Name (Restricted) ---");
        const update2 = await put(`${API_URL}/users/${studentId}`, {
            name: "Hacked Name"
        }, studentToken);

        if (update2.status === 403) {
            console.log("Verified: Student blocked from updating Name (403 Forbidden)");
        } else {
            console.error("Error: Student allowed to update name or unexpected status", update2.status);
        }

        // 3. Admin updates Name (Success)
        console.log("\n--- Test 3: Admin updates Name (Allowed) ---");
        const update3 = await put(`${API_URL}/users/${studentId}`, {
            name: "Admin Changed Name"
        }, adminToken);

        if (update3.status === 200 && update3.data.user.name === "Admin Changed Name") {
            console.log("Verified: Admin updated name successfully");
        } else {
            console.error("Error: Admin update name failed", update3.data);
        }

        // 4. Admin updates Phone (Success)
        console.log("\n--- Test 4: Admin updates Phone (Allowed) ---");
        const update4 = await put(`${API_URL}/users/${studentId}`, {
            phone: "9999999999"
        }, adminToken);

        if (update4.status === 200 && update4.data.user.phone === "9999999999") {
            console.log("Verified: Admin updated phone successfully");
        } else {
            console.error("Error: Admin update phone failed", update4.data);
        }

    } catch (err) {
        console.error("Unexpected error:", err);
    } finally {
        await mongoose.connection.close();
    }
};

runVerification();
