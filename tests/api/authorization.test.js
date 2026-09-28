import "../env.js";
import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import {
  TEST_PASSWORD,
  authHeader,
  createActiveUser,
  resetDatabase,
  startTestApp,
  stopTestApp,
} from "../setup.js";

let app;

async function login(email) {
  const response = await request(app).post("/api/auth/login").send({
    email,
    password: TEST_PASSWORD,
  });
  assert.equal(response.status, 200);
  return response.body.accessToken;
}

before(async () => {
  app = await startTestApp();
});

after(async () => {
  await stopTestApp();
});

beforeEach(async () => {
  await resetDatabase();
});

test("students cannot manage courses, batches, approvals, or Zen sync", async () => {
  await createActiveUser({ email: "student@progz.test", role: "student" });
  await createActiveUser({ email: "admin@progz.test", role: "admin" });
  const studentToken = await login("student@progz.test");
  const adminToken = await login("admin@progz.test");

  const course = await request(app)
    .post("/api/courses")
    .set(authHeader(studentToken))
    .send({ courseName: "Blocked", courseDuration: 10 });
  assert.equal(course.status, 403);

  const batches = await request(app)
    .get("/api/batches")
    .set(authHeader(studentToken));
  assert.equal(batches.status, 403);

  const sync = await request(app)
    .post("/api/sync/manual")
    .set(authHeader(studentToken));
  assert.equal(sync.status, 403);

  const anonymous = await request(app).get("/api/courses");
  assert.equal(anonymous.status, 401);

  const logs = await request(app)
    .get("/api/sync/logs")
    .set(authHeader(adminToken));
  assert.equal(logs.status, 200);

  const unconfigured = await request(app)
    .post("/api/sync/manual")
    .set(authHeader(adminToken));
  assert.equal(unconfigured.status, 500);
  assert.match(unconfigured.body.error, /ZEN_API_BASE_URL/);
});

test("course progress is refused unless the student is enrolled in that batch", async () => {
  const trainer = await createActiveUser({ email: "trainer@progz.test", role: "trainer" });
  const student = await createActiveUser({ email: "learner@progz.test", role: "student" });
  const trainerToken = await login("trainer@progz.test");
  const studentToken = await login("learner@progz.test");

  const course = await request(app)
    .post("/api/courses")
    .set(authHeader(trainerToken))
    .send({
      courseName: "Private Course",
      courseDuration: 12,
      modules: [{ title: "Start", sections: [{ sectionName: "Welcome" }] }],
    });
  assert.equal(course.status, 201);

  const progress = await request(app)
    .get(`/api/student/course/${course.body._id}/progress`)
    .set(authHeader(studentToken));
  assert.equal(progress.status, 403);

  const outsiderJoin = await request(app)
    .post("/api/class-session/join")
    .set(authHeader(studentToken))
    .send({ batchId: trainer._id });
  assert.equal(outsiderJoin.status, 404);

  assert.ok(student._id);
});
