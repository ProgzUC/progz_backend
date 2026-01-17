import mongoose from "mongoose";
import dotenv from "dotenv";
import Course from "./models/Course.js";
import User from "./models/User.js";
import RecycleBin from "./models/RecycleBin.js";
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
    }
};

const runVerification = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        await ensureAdmin();

        // Login Admin
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


        // 1. Course Recycle Bin Test
        console.log("\n=== Testing Course Recycle Bin ===");
        const courseData = {
            courseName: "Bin Test Course",
            courseId: "BIN-101",
            courseDescription: "Testing bin",
            courseDuration: 60,
            modules: []
        };

        // Create Course
        const createCourseRes = await post(`${API_URL}/courses`, courseData, adminToken);
        console.log("Created course:", createCourseRes.status);
        const courseId = createCourseRes.data._id;

        // Delete Course (Move to Bin)
        const delCourseRes = await del(`${API_URL}/courses/${courseId}`, adminToken);
        console.log("Deleted course result:", delCourseRes.data.message);

        // Verify in Bin
        const binRes = await get(`${API_URL}/bin`, adminToken);
        const binItem = binRes.data.find(i => i.originalId === courseId);
        if (binItem) console.log("Verified: Course found in recycle bin");
        else console.error("Error: Course NOT found in bin");

        // Verify NOT in Courses
        const courseCheck = await Course.findById(courseId);
        if (!courseCheck) console.log("Verified: Course removed from main collection");
        else console.error("Error: Course still exists in main collection");

        // Restore Course
        if (binItem) {
            const restoreRes = await post(`${API_URL}/bin/${binItem._id}/restore`, {}, adminToken);
            console.log("Restore result:", restoreRes.data.message);

            const restoredCourse = await Course.findById(courseId);
            if (restoredCourse) console.log("Verified: Course restored to main collection");
            else console.error("Error: Course NOT restored");

            // Verify removed from Bin
            const binCheck = await RecycleBin.findById(binItem._id);
            if (!binCheck) console.log("Verified: Item removed from bin");
            else console.error("Error: Item still in bin");
        }

        // 2. User Recycle Bin Test
        console.log("\n=== Testing User Recycle Bin ===");
        const userEmail = "bintestuser@example.com";

        // Register User (and approve manually/hack into DB for speed, or user register endpoint if public)
        // We already have register endpoint
        await User.findOneAndDelete({ email: userEmail }); // clean

        // Create directly in DB to skip pending flow for speed (we tested pending already)
        const newUser = await User.create({
            name: "Bin Test User",
            email: userEmail,
            password: "password",
            role: "student",
            phone: "111",
            employmentStatus: "Student"
        });
        const userId = newUser._id;
        console.log("Created test user:", userId);

        // Delete User
        const delUserRes = await del(`${API_URL}/users/${userId}`, adminToken);
        console.log("Deleted user result:", delUserRes.data.msg);

        // Verify in Bin
        const binRes2 = await get(`${API_URL}/bin`, adminToken);
        const binItem2 = binRes2.data.find(i => i.originalId === userId.toString());
        if (binItem2) console.log("Verified: User found in recycle bin");
        else console.error("Error: User NOT found in bin");

        // Permanent Delete
        if (binItem2) {
            const permDelRes = await del(`${API_URL}/bin/${binItem2._id}`, adminToken);
            console.log("Permanent delete result:", permDelRes.data.message);

            const binCheck2 = await RecycleBin.findById(binItem2._id);
            if (!binCheck2) console.log("Verified: User permanently deleted from bin");
            else console.error("Error: User still in bin after permanent delete");
        }

    } catch (err) {
        console.error("Unexpected error:", err);
    } finally {
        await mongoose.connection.close();
    }
};

runVerification();
