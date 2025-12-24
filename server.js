import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import createOrUpdateAdmin from "./utils/createOrUpdateAdmin.js";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
dotenv.config();

connectDB();
console.log("Environment:", process.env.MONGO_URI );

const app = express();
app.use(cors());
app.use(express.json());

// createOrUpdateAdmin();
app.use("/api/auth", authRoutes);

// const createDemoUsers = async () => {
//   try {
//     // ===== TRAINER =====
//     const trainerEmail = "trainer@urbancode.com";

//     const trainerExists = await User.findOne({ email: trainerEmail });

//     if (!trainerExists) {
//       const trainerPassword = await bcrypt.hash("Trainer@123", 10);

//       await User.create({
//         name: "Demo Trainer",
//         email: trainerEmail,
//         password: trainerPassword,
//         phone: "9000000001",
//         address: "Chennai",
//         education: "MSc Computer Science",
//         profession: "Trainer",
//         experience: "5+ years",
//         role: "trainer",
//       });

//       console.log("✅ Demo Trainer created");
//     } else {
//       console.log("ℹ️ Demo Trainer already exists");
//     }

//     // ===== STUDENT =====
//     const studentEmail = "student@urbancode.com";

//     const studentExists = await User.findOne({ email: studentEmail });

//     if (!studentExists) {
//       const studentPassword = await bcrypt.hash("Student@123", 10);

//       await User.create({
//         name: "Demo Student",
//         email: studentEmail,
//         password: studentPassword,
//         phone: "9000000002",
//         address: "Bangalore",
//         education: "BSc Computer Science",
//         university: "Anna University",
//         employmentStatus: "Student",
//         role: "student",
//       });

//       console.log("✅ Demo Student created");
//     } else {
//       console.log("ℹ️ Demo Student already exists");
//     }

//   } catch (error) {
//     console.error("❌ Error creating demo users:", error.message);
//   }
// };
// createDemoUsers();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
