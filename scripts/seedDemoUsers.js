import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

async function upsertDemoUser(userInput) {
  const existing = await User.findOne({ email: userInput.email }).lean();
  if (existing) {
    console.log(`${userInput.role} already exists: ${userInput.email}`);
    return;
  }

  const hashed = await bcrypt.hash(userInput.passwordPlain, 10);

  await User.create({
    name: userInput.name,
    email: userInput.email,
    password: hashed,
    phone: userInput.phone,
    address: userInput.address,
    education: userInput.education,
    university: userInput.university,
    profession: userInput.profession,
    employmentStatus: userInput.employmentStatus,
    experience: userInput.experience,
    skills: userInput.skills,
    role: userInput.role,
    source: "seed",
  });

  console.log(`${userInput.role} created: ${userInput.email}`);
  console.log(`Password: ${userInput.passwordPlain}`);
}

async function main() {
  await connectDB();

  const users = [
    {
      name: process.env.DEMO_TRAINER_NAME || "Demo Trainer",
      email: process.env.DEMO_TRAINER_EMAIL || "trainer@urbancode.com",
      passwordPlain: process.env.DEMO_TRAINER_PASSWORD || "Trainer@123",
      phone: process.env.DEMO_TRAINER_PHONE || "9000000001",
      address: process.env.DEMO_TRAINER_ADDRESS || "Chennai",
      education: process.env.DEMO_TRAINER_EDUCATION || "MCA",
      university: process.env.DEMO_TRAINER_UNIVERSITY || "Anna University",
      profession: process.env.DEMO_TRAINER_PROFESSION || "Full Stack Trainer",
      employmentStatus: process.env.DEMO_TRAINER_EMPLOYMENT_STATUS || "Working",
      experience: process.env.DEMO_TRAINER_EXPERIENCE || "6 years",
      skills: process.env.DEMO_TRAINER_SKILLS || "Node.js,React,MongoDB",
      role: "trainer",
    },
    {
      name: process.env.DEMO_STUDENT_NAME || "Demo Student",
      email: process.env.DEMO_STUDENT_EMAIL || "student@urbancode.com",
      passwordPlain: process.env.DEMO_STUDENT_PASSWORD || "Student@123",
      phone: process.env.DEMO_STUDENT_PHONE || "9000000002",
      address: process.env.DEMO_STUDENT_ADDRESS || "Bangalore",
      education: process.env.DEMO_STUDENT_EDUCATION || "BSc Computer Science",
      university: process.env.DEMO_STUDENT_UNIVERSITY || "Anna University",
      profession: process.env.DEMO_STUDENT_PROFESSION || "Learner",
      employmentStatus: process.env.DEMO_STUDENT_EMPLOYMENT_STATUS || "Student",
      experience: process.env.DEMO_STUDENT_EXPERIENCE || "0 years",
      skills: process.env.DEMO_STUDENT_SKILLS || "JavaScript,HTML,CSS",
      role: "student",
    },
  ];

  for (const user of users) {
    await upsertDemoUser(user);
  }
}

main()
  .catch((err) => {
    console.error("Seed demo users failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });

