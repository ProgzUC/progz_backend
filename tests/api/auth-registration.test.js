import "../env.js";
import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import request from "supertest";
import User from "../../models/User.js";
import {
  TEST_PASSWORD,
  authHeader,
  createActiveUser,
  resetDatabase,
  startTestApp,
  stopTestApp,
} from "../setup.js";

let app;

before(async () => {
  app = await startTestApp();
});

after(async () => {
  await stopTestApp();
});

beforeEach(async () => {
  await resetDatabase();
});

test("direct registration is disabled", async () => {
  const response = await request(app).post("/api/auth/register").send({
    email: "new@progz.test",
    password: TEST_PASSWORD,
    role: "student",
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.code, "REGISTRATION_DISABLED");
});

test("self-registration creates a pending student and blocks admin signup", async () => {
  const created = await request(app).post("/api/users/register").send({
    name: "New Student",
    email: "student@progz.test",
    password: TEST_PASSWORD,
    role: "student",
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.user.status, "pending");

  const adminSignup = await request(app).post("/api/users/register").send({
    email: "admin@progz.test",
    password: TEST_PASSWORD,
    role: "admin",
  });
  assert.equal(adminSignup.status, 400);

  const shortPassword = await request(app).post("/api/users/register").send({
    email: "short@progz.test",
    password: "short",
    role: "student",
  });
  assert.equal(shortPassword.status, 400);

  const login = await request(app).post("/api/auth/login").send({
    email: "student@progz.test",
    password: TEST_PASSWORD,
  });
  assert.equal(login.status, 401);
});

test("active users can log in and read their session", async () => {
  await createActiveUser({ email: "trainer@progz.test", role: "trainer", name: "Trainer" });
  const login = await request(app).post("/api/auth/login").send({
    email: "trainer@progz.test",
    password: TEST_PASSWORD,
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.role, "trainer");
  assert.ok(login.body.accessToken);

  const me = await request(app)
    .get("/api/auth/me")
    .set(authHeader(login.body.accessToken));
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, "trainer@progz.test");

  const missing = await request(app).get("/api/auth/me");
  assert.equal(missing.status, 401);
});

test("unknown password reset requests do not reveal whether the account exists", async () => {
  const response = await request(app).post("/api/auth/forgot-password").send({
    email: "missing@progz.test",
  });
  assert.equal(response.status, 200);
  assert.match(response.body.msg, /If user exists/i);
});

test("a valid reset token changes the password and an invalid token does not", async () => {
  const user = await createActiveUser({ email: "reset@progz.test", role: "student" });
  const token = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");
  user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
  await user.save();

  const invalid = await request(app)
    .post(`/api/auth/reset-password/${"a".repeat(64)}`)
    .send({ password: "NewPassword1" });
  assert.equal(invalid.status, 400);

  const reset = await request(app)
    .post(`/api/auth/reset-password/${token}`)
    .send({ password: "NewPassword1" });
  assert.equal(reset.status, 200);

  const oldLogin = await request(app).post("/api/auth/login").send({
    email: "reset@progz.test",
    password: TEST_PASSWORD,
  });
  assert.equal(oldLogin.status, 401);

  const newLogin = await request(app).post("/api/auth/login").send({
    email: "reset@progz.test",
    password: "NewPassword1",
  });
  assert.equal(newLogin.status, 200);

  const stored = await User.findById(user._id);
  assert.equal(stored.resetPasswordToken, undefined);
});
