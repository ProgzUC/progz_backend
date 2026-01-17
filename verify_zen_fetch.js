import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import bcrypt from "bcryptjs";

dotenv.config();

const API_URL = "http://127.0.0.1:5001/api";

const post = async (url, data, token) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(data) });
    const text = await res.text();
    try {
        return { status: res.status, data: JSON.parse(text) };
    } catch (e) {
        console.error(`Status: ${res.status}. Body: ${text.substring(0, 200)}`);
        throw e;
    }
};

const get = async (url, token) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { method: "GET", headers });
    const text = await res.text();
    try {
        return { status: res.status, data: JSON.parse(text) };
    } catch (e) {
        console.error(`Status: ${res.status}. Body: ${text.substring(0, 200)}`);
        throw e;
    }
};

const setupData = async () => {
    let admin = await User.findOne({ role: "admin" });
    if (!admin) {
        // Fallback if no admin exists (unlikely in this flow)
        const hashed = await bcrypt.hash("Admin@123", 10);
        admin = await User.create({ name: "Admin", email: "verify_zen@progz.in", password: hashed, role: "admin", phone: "000" });
    }
    return { admin };
};

const runVerification = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");
        const { admin } = await setupData();

        // Login Admin
        const loginRes = await post(`${API_URL}/auth/login`, { email: admin.email, password: "Admin@123" });
        const token = loginRes.data.accessToken;

        console.log("\n--- Step 1: Fetch Zen Trainers ---");
        const res = await get(`${API_URL}/sync/trainers`, token);

        if (res.status === 200 && Array.isArray(res.data)) {
            console.log("Fetch Success. Count:", res.data.length);
            if (res.data.length > 0) {
                console.log("Sample Trainer:", res.data[0].trainer_name, res.data[0].trainer_email);
            } else {
                console.log("Warning: No trainers returned (API might be empty or key invalid)");
            }
        } else {
            console.error("Fetch Failed:", res.status, res.data);
        }

    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        await mongoose.connection.close();
    }
};

runVerification();
