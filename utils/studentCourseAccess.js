import { getBatchCourseIds } from "./batchCourses.js";

function sameId(left, right) {
    return String(left?._id || left || "") === String(right?._id || right || "");
}

/** Student is on the batch roster and the batch still includes this course. */
export function isProperlyEnrolled(studentId, courseId, batch) {
    if (!studentId || !courseId || !batch) return false;
    const onRoster = (batch.students || []).some((student) => sameId(student, studentId));
    if (!onRoster) return false;

    const courseIds = new Set(getBatchCourseIds(batch));
    if (batch.course) courseIds.add(String(batch.course._id || batch.course));
    (batch.courses || []).forEach((course) => {
        if (course) courseIds.add(String(course._id || course));
    });
    return courseIds.has(String(courseId));
}
