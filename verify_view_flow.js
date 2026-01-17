import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import bcrypt from "bcryptjs";

dotenv.config();

const API_URL = "http://localhost:5000/api";

const post = async (url, data, token) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(data) });
    return { status: res.status, data: await res.json() };
};

const get = async (url, token) => {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
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

        // Create Test Students
        const student1Email = "viewtest1@example.com";
        const student2Email = "viewtest2@example.com";
        await User.deleteMany({ email: { $in: [student1Email, student2Email] } });

        const pwd = await bcrypt.hash("password", 10);
        const s1 = await User.create({ name: "Student One", email: student1Email, password: pwd, role: "student", phone: "111" });
        const s2 = await User.create({ name: "Student Two", email: student2Email, password: pwd, role: "student", phone: "222" });
        console.log("Created test students:", s1._id, s2._id);

        // Login Student 1
        console.log("\n--- Logging in as Student 1 ---");
        const s1Login = await post(`${API_URL}/auth/login`, { email: student1Email, password: "password" });
        const s1Token = s1Login.data.accessToken;

        // 1. Student 1 Views Self (Pass)
        console.log("\n--- Test 1: Student Views Self (Allowed) ---");
        const v1 = await get(`${API_URL}/users/${s1._id}`, s1Token);
        if (v1.status === 200 && v1.data._id === s1._id.toString()) console.log("Verified: Student viewed self");
        else console.error("Error: Student view self failed", v1.status);

        // 2. Student 1 Views Student 2 (Fail)
        console.log("\n--- Test 2: Student Views Other (Forbidden) ---");
        const v2 = await get(`${API_URL}/users/${s2._id}`, s1Token);
        if (v2.status === 403) console.log("Verified: Student blocked from viewing other");
        else console.error("Error: Student allowed to view other", v2.status);

        // 3. Admin Views Student 2 (Pass)
        console.log("\n--- Test 3: Admin Views Student (Allowed) ---");
        const v3 = await get(`${API_URL}/users/${s2._id}`, adminToken);
        if (v3.status === 200 && v3.data._id === s2._id.toString()) console.log("Verified: Admin viewed student");
        else console.error("Error: Admin view student failed", v3.status);

    } catch (err) {
        console.error("Unexpected error:", err);
    } finally {
        await mongoose.connection.close();
    }
};

runVerification();
