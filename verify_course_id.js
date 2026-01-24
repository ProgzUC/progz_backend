
import mongoose from 'mongoose';
import Course from './models/Course.js';
import { createCourse } from './controllers/courseController.js';
import dotenv from 'dotenv';

dotenv.config();

// Mock req and res
const mockReq = {
    body: {
        courseName: "Introduction to React Native",
        courseDescription: "Learn React Native",
        courseDuration: 10,
        modules: [],
        thumbnail: { url: "http://example.com/img.png" }
    },
    user: {
        id: new mongoose.Types.ObjectId() // Mock user ID
    }
};

const mockRes = {
    status: function (code) {
        this.statusCode = code;
        return this;
    },
    json: function (data) {
        console.log(`Response Status: ${this.statusCode}`);
        console.log("Response Data:", data);
    }
};

// Connect to DB (Mock or Real?)
// Ideally should use a test DB or mock the DB calls.
// Since I can't easily spin up a test DB here without config, I will try to mock mongoose.model functions or rely on unit testing style if I can't run e2e.
// However, the user environment seems to be a real dev environment.
// Let's try to just call the function and mock the DB calls if possible, or just review the code logic if DB connection is missing.
// Actually, I can just rely on manual verification plan which involved "Send a POST request". 
// But I don't have a running server I can hit from here easily without knowing if it's running.
// The safer bet is to create a script that IMPORTS the controller and MOCKS the Mongoose models.

// Let's mock Course.findOne and Course.create
Course.findOne = async () => null; // Simulate no collision
Course.create = async (data) => {
    console.log("Course.create called with:", data);
    return data;
};

console.log("--- Test 1: Create Course with Name 'Introduction to React Native' ---");
await createCourse(mockReq, mockRes);

console.log("\n--- Test 2: Create Course with Special Characters 'Advanced C++ & Rust!' ---");
mockReq.body.courseName = "Advanced C++ & Rust!";
await createCourse(mockReq, mockRes);
