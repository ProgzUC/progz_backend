import connectDB from "./config/db.js";
import Course from "./models/Course.js";
import dotenv from "dotenv";

dotenv.config();

const run = async () => {
    try {
        await connectDB();
        console.log("Connected. Fetching courses...");
        
        const courses = await Course.find({}).populate("instructor", "name email").lean();
        
        console.log("Fetched", courses.length, "courses.");
        
        const formatted = courses.map((course) => {
          const { enrolledStudents, ...rest } = course;
          return {
            ...rest,
            enrolledCount: Array.isArray(enrolledStudents) ? enrolledStudents.length : 0,
          };
        });
        
        if (formatted.length > 0) {
            console.log("Formatted course 0 keys:", Object.keys(formatted[0]));
            console.log("Enrolled count for course 0:", formatted[0].enrolledCount);
        } else {
            console.log("No courses found");
        }
        
        process.exit(0);
    } catch (e) {
        console.error("Error!!!", e);
        process.exit(1);
    }
}
run();
