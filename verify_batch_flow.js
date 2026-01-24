import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Course from "./models/Course.js";
import Batch from "./models/Batch.js";
import bcrypt from "bcryptjs";

dotenv.config();

const API_URL = "http://127.0.0.1:5002/api";

const post = async (url, data, token) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(data) });
    const text = await res.text();
    try {
        return { status: res.status, data: JSON.parse(text) };
    } catch (e) {
        console.error(`Failed to parse JSON from ${url}. Status: ${res.status}. Body: ${text.substring(0, 200)}`);
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
        console.error(`Failed to parse JSON from ${url}. Status: ${res.status}. Body: ${text.substring(0, 200)}`);
        throw e;
    }
};

const setupData = async () => {
    // 1. Ensure Admin
    let admin = await User.findOne({ role: "admin" });
    const adminPass = await bcrypt.hash("Admin@123", 10);
    if (!admin) {
        admin = await User.create({ name: "Admin", email: "admin_batch@progz.in", password: adminPass, role: "admin", phone: "111", isApproved: true });
    } else {
        admin.password = adminPass;
        admin.isApproved = true; // Ensure approved just in case
        await admin.save();
    }

    // 2. Ensure Course
    let course = await Course.findOne();
    if (!course) {
        course = await Course.create({ courseName: "Batch Test Course", courseId: "BTC01", duration: "3 months", price: 1000 });
    }

    // 3. Ensure Trainer
    let trainer = await User.findOne({ role: "trainer" });
    if (!trainer) {
        const hashed = await bcrypt.hash("Trainer@123", 10);
        trainer = await User.create({ name: "Trainer", email: "trainer_batch@progz.in", password: hashed, role: "trainer", phone: "222" });
    }

    // 4. Ensure Student
    let student = await User.findOne({ role: "student" });
    if (!student) {
        const hashed = await bcrypt.hash("Student@123", 10);
        student = await User.create({ name: "Student", email: "student_batch@progz.in", password: hashed, role: "student", phone: "333" });
    }

    return { admin, course, trainer, student };
};

const runVerification = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");
        const { admin, course, trainer, student } = await setupData();

        // Login Admin
        const loginRes = await post(`${API_URL}/auth/login`, { email: admin.email, password: "Admin@123" });
        const token = loginRes.data.accessToken;
        if (!token) throw new Error("Login failed");

        console.log("\n--- Step 1: Create Batch ---");
        const batchData = {
            name: "Jan 2024 Full Stack",
            course: course._id,
            classTiming: {
                startTime: "10:00 AM",
                endTime: "12:00 PM"
            },
            startDate: "2024-01-01",
            daysOfWeek: ["Monday", "Wednesday", "Friday"]
        };
        const createRes = await post(`${API_URL}/batches`, batchData, token);
        const batchId = createRes.data._id;
        console.log("Batch Created:", createRes.status === 201 ? "SUCCESS" : "FAILED", createRes.data.name);

        console.log("\n--- Step 2: Assign Trainer with Modules ---");
        const trainerData = {
            trainers: [{
                trainer: trainer._id,
                assignedModules: [1, 2],
                fromDate: "2024-01-01",
                toDate: "2024-02-01",
                isCurrent: true
            }]
        };
        const assignRes = await post(`${API_URL}/batches/${batchId}/trainers`, trainerData, token);
        console.log("Trainers Assigned:", assignRes.status === 200 ? "SUCCESS" : "FAILED");

        console.log("\n--- Step 3: Enroll Student ---");
        const enrollRes = await post(`${API_URL}/batches/${batchId}/enroll`, { studentId: student._id }, token);
        console.log("Student Enrolled:", enrollRes.status === 200 ? "SUCCESS" : "FAILED");

        console.log("\n--- Step 4: View Batch Details ---");
        const viewRes = await get(`${API_URL}/batches/${batchId}`, token);
        console.log("View Batch:", viewRes.status === 200 ? "SUCCESS" : "FAILED");
        console.log("Students Count:", viewRes.data.students.length);
        console.log("Trainers Assigned:", viewRes.data.trainers[0].trainer.name);

        console.log("\n--- Step 5: Remove Student ---");
        const removeRes = await post(`${API_URL}/batches/${batchId}/remove-student`, { studentId: student._id }, token);
        console.log("Student Removed:", removeRes.status === 200 ? "SUCCESS" : "FAILED");

        console.log("\n--- Step 6: Verify Student Enrollment Clear ---");
        const updatedUser = await User.findById(student._id);
        const enrollment = updatedUser.enrolledCourses.find(e => e.course.toString() === course._id.toString());
        console.log("Batch ref cleared in User:", enrollment.batch === undefined ? "YES" : "NO");

    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        await mongoose.connection.close();
    }
};

runVerification();
