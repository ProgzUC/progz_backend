import "../env.js";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import request from "supertest";
import {
  TEST_PASSWORD,
  authHeader,
  createActiveUser,
  startTestApp,
  stopTestApp,
} from "../setup.js";

let app;

async function login(email, password = TEST_PASSWORD) {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  assert.equal(response.status, 200, response.body.msg || response.body.message);
  return response.body.accessToken;
}

before(async () => {
  app = await startTestApp();
});

after(async () => {
  await stopTestApp();
});

test("registration, course, batch, enrollment, attendance, and password reset", async () => {
  await createActiveUser({ email: "admin@progz.test", role: "admin", name: "Admin" });
  const trainer = await createActiveUser({ email: "trainer@progz.test", role: "trainer", name: "Trainer" });
  const adminToken = await login("admin@progz.test");
  const trainerToken = await login("trainer@progz.test");

  const registration = await request(app).post("/api/users/register").send({
    name: "Asha",
    email: "asha@progz.test",
    password: TEST_PASSWORD,
    role: "student",
  });
  assert.equal(registration.status, 201);

  const approved = await request(app)
    .post(`/api/users/approve/${registration.body.user.id}`)
    .set(authHeader(adminToken));
  assert.equal(approved.status, 200);

  const studentToken = await login("asha@progz.test");

  const course = await request(app)
    .post("/api/courses")
    .set(authHeader(trainerToken))
    .send({
      courseName: "Java Basics",
      courseDuration: 20,
      courseDurationMonths: 2,
      modules: [{ title: "Basics", sections: [{ sectionName: "Hello Java" }] }],
    });
  assert.equal(course.status, 201);
  const courseId = course.body._id;

  const hidden = await request(app)
    .get(`/api/courses/${courseId}`)
    .set(authHeader(studentToken));
  assert.equal(hidden.status, 403);

  const batch = await request(app)
    .post("/api/batches")
    .set(authHeader(trainerToken))
    .send({
      name: "Java Morning",
      course: courseId,
      trainers: [{ trainer: trainer._id, isCurrent: true }],
      classTiming: { startTime: "10:00", endTime: "11:00" },
      daysOfWeek: ["Monday"],
      meetLink: "https://meet.example.test/java",
      status: "active",
    });
  assert.equal(batch.status, 201, JSON.stringify(batch.body));
  const batchId = batch.body._id || batch.body.batch?._id;

  const enrolled = await request(app)
    .post(`/api/batches/${batchId}/enroll`)
    .set(authHeader(trainerToken))
    .send({ studentId: approved.body.user.id });
  assert.equal(enrolled.status, 200);

  const progress = await request(app)
    .get(`/api/student/course/${courseId}/progress`)
    .set(authHeader(studentToken));
  assert.equal(progress.status, 200);
  assert.equal(progress.body.course.modules[0].sections[0].sectionName, "Hello Java");

  const myCourses = await request(app)
    .get("/api/student/my-courses")
    .set(authHeader(studentToken));
  assert.equal(myCourses.status, 200);
  assert.equal(myCourses.body.enrolledCourses.length, 1);

  const started = await request(app)
    .post("/api/class-session/start")
    .set(authHeader(trainerToken))
    .send({ batchId });
  assert.equal(started.status, 201);

  const joined = await request(app)
    .post("/api/class-session/join")
    .set(authHeader(studentToken))
    .send({ batchId });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.status, "Present");
  assert.equal(joined.body.session, undefined);

  const attendance = await request(app)
    .get("/api/class-session/student/me")
    .set(authHeader(studentToken));
  assert.equal(attendance.status, 200);
  assert.equal(attendance.body.summary.present, 1);

  const token = crypto.randomBytes(32).toString("hex");
  const User = (await import("../../models/User.js")).default;
  const student = await User.findOne({ email: "asha@progz.test" });
  student.resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");
  student.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
  await student.save();

  const reset = await request(app)
    .post(`/api/auth/reset-password/${token}`)
    .send({ password: "ChangedPassword1" });
  assert.equal(reset.status, 200);
  await login("asha@progz.test", "ChangedPassword1");
});
