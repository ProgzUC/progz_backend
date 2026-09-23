import Course from "../models/Course.js";

/** Sync a student's enrolledCourses + Course.enrolledStudents for the given batch courses. */
export const enrollStudentIntoCourses = async (student, batchId, courseIds) => {
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
