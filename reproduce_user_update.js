import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import { updateUser } from "./controllers/userController.js";

dotenv.config();

const reproduceIssue = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to MongoDB");

        // 1. Create a Test Admin User
        const adminUser = await User.create({
            name: "Test Admin",
            email: `admin_${Date.now()}@example.com`,
            password: "password",
            role: "admin",
            phone: "1111111111"
        });
        console.log("✅ Admin User Created:", adminUser._id);

        // 2. Create a Target User
        const targetUser = await User.create({
            name: "Target User",
            email: `target_${Date.now()}@example.com`,
            password: "password",
            role: "student",
            phone: "2222222222",
            education: "Old Education"
        });
        console.log("✅ Target User Created:", targetUser._id);

        // 3. Mock Request/Response for Update
        const req = {
            params: { id: targetUser._id.toString() },
            user: { id: adminUser._id.toString(), role: "admin" }, // Simulate Admin context
            body: {
                name: "Updated Target Name",
                education: "New Education",
                skills: "React, Node"
            }
        };

        const res = {
            status: (code) => ({
                json: (data) => console.log(`Response [${code}]:`, JSON.stringify(data, null, 2))
            }),
            json: (data) => console.log(`Response [200]:`, JSON.stringify(data, null, 2))
        };

        console.log("3️⃣ calling updateUser...");
        await updateUser(req, res);

        // 4. Verify Update in DB
        const updatedUser = await User.findById(targetUser._id);
        if (updatedUser.name === "Updated Target Name" && updatedUser.education === "New Education") {
            console.log("✅ User updated successfully in DB!");
        } else {
            console.error("❌ User update FAILED in DB.");
            console.log("Expected: Updated Target Name, New Education");
            console.log("Actual:", updatedUser.name, updatedUser.education);
        }

        // Cleanup
        await User.findByIdAndDelete(adminUser._id);
        await User.findByIdAndDelete(targetUser._id);
        console.log("Cleanup complete.");

    } catch (error) {
        console.error("❌ Reproduction Script Failed:", error);
    } finally {
        await mongoose.disconnect();
    }
};

reproduceIssue();
