import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

async function main() {
  await connectDB();

  const email = process.env.DEMO_STUDENT_EMAIL || "student@urbancode.com";
  const passwordPlain = process.env.DEMO_STUDENT_PASSWORD || "Student@123";

  const existing = await User.findOne({ email }).lean();
  if (existing) {
    console.log(`ℹ️ Demo student already exists: ${email}`);
    return;
  }

  const hashed = await bcrypt.hash(passwordPlain, 10);

  await User.create({
    name: process.env.DEMO_STUDENT_NAME || "Demo Student",
    email,
    password: hashed,
    phone: process.env.DEMO_STUDENT_PHONE || "9000000002",
    address: process.env.DEMO_STUDENT_ADDRESS || "Bangalore",
    education: process.env.DEMO_STUDENT_EDUCATION || "BSc Computer Science",
    university: process.env.DEMO_STUDENT_UNIVERSITY || "Anna University",
    employmentStatus: process.env.DEMO_STUDENT_EMPLOYMENT_STATUS || "Student",
    role: "student",
    source: "seed",
  });

  console.log(`✅ Demo student created: ${email}`);
  console.log(`🔐 Password: ${passwordPlain}`);
}

main()
  .catch((err) => {
    console.error("❌ Seed demo student failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });

