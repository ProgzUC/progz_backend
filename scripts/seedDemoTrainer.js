import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

async function main() {
  await connectDB();

  const email = process.env.DEMO_TRAINER_EMAIL || "trainer@urbancode.com";
  const passwordPlain = process.env.DEMO_TRAINER_PASSWORD || "Trainer@123";

  const existing = await User.findOne({ email }).lean();
  if (existing) {
    console.log(`Demo trainer already exists: ${email}`);
    return;
  }

  const hashed = await bcrypt.hash(passwordPlain, 10);

  await User.create({
    name: process.env.DEMO_TRAINER_NAME || "Demo Trainer",
    email,
    password: hashed,
    phone: process.env.DEMO_TRAINER_PHONE || "9000000001",
    address: process.env.DEMO_TRAINER_ADDRESS || "Chennai",
    education: process.env.DEMO_TRAINER_EDUCATION || "MCA",
    university: process.env.DEMO_TRAINER_UNIVERSITY || "Anna University",
    profession: process.env.DEMO_TRAINER_PROFESSION || "Full Stack Trainer",
    employmentStatus: process.env.DEMO_TRAINER_EMPLOYMENT_STATUS || "Working",
    experience: process.env.DEMO_TRAINER_EXPERIENCE || "6 years",
    skills: process.env.DEMO_TRAINER_SKILLS || "Node.js,React,MongoDB",
    role: "trainer",
    source: "seed",
  });

  console.log(`Demo trainer created: ${email}`);
  console.log(`Password: ${passwordPlain}`);
}

main()
  .catch((err) => {
    console.error("Seed demo trainer failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });

