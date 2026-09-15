/**
 * One-off repair: re-sync student enrollments for batches whose courses
 * were updated after students were enrolled (multi-course rollout).
 *
 * Usage: node scripts/repairBatchCourseEnrollments.js [batchName]
 * Default batchName: FSD-THAYA
 */
import "dotenv/config";
import mongoose from "mongoose";
import Batch from "../models/Batch.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import { getBatchCourseIds } from "../utils/batchCourses.js";

const batchName = process.argv[2] || "FSD-THAYA";

const enrollStudentIntoCourses = async (student, batchId, courseIds) => {
  for (const courseId of courseIds) {
    const existing = student.enrolledCourses.find(
      (e) => e.course?.toString() === courseId.toString()
    );
    if (existing) {
      existing.batch = batchId;
    } else {
      student.enrolledCourses.push({
        course: courseId,
        batch: batchId,
        enrolledAt: new Date(),
      });
    }

    await Course.updateOne(
      { _id: courseId, "enrolledStudents.student": { $ne: student._id } },
      {
        $push: {
          enrolledStudents: {
            student: student._id,
            enrolledDate: new Date(),
            batchId,
          },
        },
      }
    );
  }
  await student.save();
};

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected. Repairing batch:", batchName);

  const batch = await Batch.findOne({ name: batchName }).populate("courses", "courseName");
  if (!batch) {
    console.error("Batch not found:", batchName);
    process.exit(1);
  }

  const courseIds = getBatchCourseIds(batch);
  console.log("Batch courses:", courseIds.length, batch.courses?.map((c) => c.courseName) || courseIds);
  console.log("Students on batch:", (batch.students || []).length);

  if (!courseIds.length) {
    console.error("Batch has no courses to sync.");
    process.exit(1);
  }

  const courseIdSet = new Set(courseIds.map(String));
  const batchId = String(batch._id);
  let fixed = 0;

  for (const studentId of batch.students || []) {
    const student = await User.findById(studentId);
    if (!student) {
      console.warn("Missing student:", studentId);
      continue;
    }

    const before = (student.enrolledCourses || []).length;
    student.enrolledCourses = (student.enrolledCourses || []).filter((e) => {
      if (String(e.batch || "") !== batchId) return true;
      return courseIdSet.has(String(e.course || ""));
    });

    await enrollStudentIntoCourses(student, batch._id, courseIds);
    const after = (student.enrolledCourses || []).length;
    console.log(`  ${student.email || student.name}: enrollments ${before} -> ${after}`);
    fixed += 1;
  }

  console.log(`Done. Synced ${fixed} student(s).`);
  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.connection.close();
  } catch (_) {}
  process.exit(1);
});
