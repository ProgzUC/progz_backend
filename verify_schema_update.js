
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import PendingUser from "./models/PendingUser.js";
import { approveUser } from "./controllers/userController.js";

dotenv.config();

const verifySchema = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to MongoDB");

        const testEmail = `test_schema_${Date.now()}@example.com`;

        // 1. Create PendingUser with NEW fields
        console.log("1️⃣ Creating PendingUser with new fields...");
        const pending = await PendingUser.create({
            name: "Test User",
            email: testEmail,
            password: "hashedpassword123",
            phone: "1234567890",
            altPhone: "0987654321",
            address: "123 Test St",
            dob: "1990-01-01",
            gender: "Male",
            education: "B.Tech",
            university: "Test University",
            profession: "Developer",
            employmentStatus: "Employed",
            experience: "5 years",
            source: "manual",
            zenCourseName: "MERN Stack",
            zenCourseType: "Full Time",
            skills: "Node.js, React",
            role: "student"
        });
        console.log("✅ PendingUser created:", pending._id);

        // Verify fields persisted in PendingUser
        const fetchedPending = await PendingUser.findById(pending._id);
        if (fetchedPending.university !== "Test University" || fetchedPending.skills !== "Node.js, React") {
            throw new Error("❌ PendingUser fields not persisted correctly!");
        }
        console.log("✅ PendingUser fields verified.");

        // 2. Approve User (Simulate Controller Logic)
        console.log("2️⃣ Approving User...");

        // Mock Req/Res
        const req = { params: { id: pending._id } };
        const res = {
            status: (code) => ({
                json: (data) => console.log(`Response [${code}]:`, data.msg || data)
            })
        };

        // We can't easily call controller directly because it expects to verify logic, 
        // but we can manually run the logic to verify model transfer.
        // Actually, let's just use the logic from the controller:

        const userData = fetchedPending.toObject();
        delete userData._id;
        delete userData.createdAt;
        delete userData.updatedAt;
        delete userData.__v;
        delete userData.status;

        const newUser = await User.create(userData);
        console.log("✅ User created from PendingUser:", newUser._id);

        // 3. Verify User fields
        if (newUser.university !== "Test University" || newUser.skills !== "Node.js, React") {
            throw new Error("❌ User fields not transferred correctly!");
        }
        console.log("✅ All fields transferred successfully to User model.");

        // Cleanup
        await User.findByIdAndDelete(newUser._id);
        await PendingUser.findByIdAndDelete(pending._id); // Should be gone anyway if we ran controller, but we ran manual logic
        console.log("Cleanup complete.");

    } catch (error) {
        console.error("❌ Verification Failed:", error);
    } finally {
        await mongoose.disconnect();
    }
};

verifySchema();
