import test from "node:test";
import assert from "node:assert/strict";
import { validatePassword, MIN_PASSWORD_LENGTH } from "../../utils/passwordValidation.js";
import { isProperlyEnrolled } from "../../utils/studentCourseAccess.js";
import { getBatchCourseIds, resolveCourseIdsFromBody } from "../../utils/batchCourses.js";
import { getNextClassDate } from "../../utils/getNextClassDate.js";
import {
  canManageCourse,
  canManageBatch,
  normalizeRole,
} from "../../utils/authorizationHelpers.js";

test("password rules reject empty and short passwords", () => {
  assert.equal(validatePassword("").ok, false);
  assert.equal(validatePassword("short").ok, false);
  assert.match(validatePassword("short").message, new RegExp(String(MIN_PASSWORD_LENGTH)));
  assert.equal(validatePassword("Password1").ok, true);
});

test("course access requires the student to be on a batch that includes the course", () => {
  const studentId = "student-1";
  const courseId = "course-1";
  const batch = {
    students: [studentId],
    course: courseId,
    courses: [],
  };

  assert.equal(isProperlyEnrolled(studentId, courseId, batch), true);
  assert.equal(isProperlyEnrolled("other-student", courseId, batch), false);
  assert.equal(isProperlyEnrolled(studentId, "other-course", batch), false);
  assert.equal(isProperlyEnrolled(studentId, courseId, null), false);
});

test("batch course ids prefer the courses list and fall back to the primary course", () => {
  assert.deepEqual(resolveCourseIdsFromBody({ courses: ["a", "a", "b"] }), ["a", "b"]);
  assert.deepEqual(resolveCourseIdsFromBody({ course: "only" }), ["only"]);
  assert.deepEqual(getBatchCourseIds({ courses: ["c1"], course: "legacy" }), ["c1"]);
  assert.deepEqual(getBatchCourseIds({ course: "legacy" }), ["legacy"]);
});

test("next class is the upcoming matching weekday", () => {
  const next = getNextClassDate(["Monday", "Wednesday", "Friday"], { startTime: "23:59" });
  assert.ok(next instanceof Date);
  assert.ok(next > new Date());
  assert.equal(getNextClassDate([], { startTime: "10:00" }), null);
});

test("role helpers keep course and batch management with the assigned staff", () => {
  assert.equal(normalizeRole("instructor"), "trainer");
  const trainer = { user: { id: "t1", role: "trainer" } };
  const student = { user: { id: "s1", role: "student" } };
  const course = { instructor: ["t1"] };
  const batch = { trainers: [{ trainer: "t1" }] };

  assert.equal(canManageCourse(trainer, course), true);
  assert.equal(canManageCourse(student, course), false);
  assert.equal(canManageBatch(trainer, batch), true);
  assert.equal(canManageBatch(student, batch), false);
});
