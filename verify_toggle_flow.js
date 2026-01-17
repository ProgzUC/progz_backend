import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Batch from "./models/Batch.js";
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
        console.error(`Failed to parse JSON from ${url}. Status: ${res.status}. Body: ${text.substring(0, 200)}`);
        throw e;
    }
};

const setupData = async () => {
    // 1. Ensure Trainer for toggling
    let trainer = await User.findOne({ role: "trainer" });
    if (!trainer) {
        const hashed = await bcrypt.hash("Trainer@123", 10);
        trainer = await User.create({ name: "Toggle Trainer", email: "toggle_trainer@progz.in", password: hashed, role: "trainer", phone: "999" });
    }

    // 2. Ensure Batch exists
    let batch = await Batch.findOne();
    if (!batch) {
        throw new Error("No batch found. Run verify_batch_flow.js first.");
    }

    return { trainer, batch };
};

const runVerification = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");
        const { trainer, batch } = await setupData();

        // Login Trainer
        const loginRes = await post(`${API_URL}/auth/login`, { email: trainer.email, password: "Trainer@123" });
        const token = loginRes.data.accessToken;

        console.log("\n--- Step 1: Mark Section as Completed ---");
        const toggle1 = await post(`${API_URL}/batches/${batch._id}/sections/toggle`, {
            moduleIndex: 1,
            sectionIndex: 0
        }, token);

        if (toggle1.status === 200 && toggle1.data.sectionProgress.isCompleted) {
            console.log("Marked Completed: SUCCESS");
            console.log("Completed By:", toggle1.data.sectionProgress.completedBy);
            console.log("Completion Time:", toggle1.data.sectionProgress.completionTime);
        } else {
            console.error("Marking Failed:", toggle1.status, toggle1.data);
        }

        console.log("\n--- Step 2: Toggle Off (Mark Incomplete) ---");
        const toggle2 = await post(`${API_URL}/batches/${batch._id}/sections/toggle`, {
            moduleIndex: 1,
            sectionIndex: 0
        }, token);

        if (toggle2.status === 200 && !toggle2.data.sectionProgress.isCompleted) {
            console.log("Marked Incomplete: SUCCESS");
            console.log("Completed By (should be undefined/null):", toggle2.data.sectionProgress.completedBy);
        } else {
            console.error("Unmarking Failed:", toggle2.status, toggle2.data);
        }

    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        await mongoose.connection.close();
    }
};

runVerification();
