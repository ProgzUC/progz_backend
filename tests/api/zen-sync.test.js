import "../env.js";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import nock from "nock";
import PendingUser from "../../models/PendingUser.js";

let mongo;

before(async () => {
  process.env.ZEN_API_BASE_URL = "http://zen.test";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

after(async () => {
  nock.cleanAll();
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test("Zen instructor sync creates a pending trainer and ignores a duplicate email", async () => {
  const payload = {
    success: true,
    trainers: [
      { trainer_name: "Zen Trainer", trainer_email: "zen.trainer@progz.test", trainer_mobile: "9000000001" },
      { trainer_name: "Zen Trainer Copy", trainer_email: "zen.trainer@progz.test", trainer_mobile: "9000000001" },
    ],
  };
  nock("http://zen.test").get("/api/trainers/progz").reply(200, payload);

  const { syncInstructors } = await import("../../services/syncService.js");
  const first = await syncInstructors();
  assert.equal(first.syncedCount, 1);
  assert.equal(first.duplicateCount, 1);

  const pending = await PendingUser.findOne({ email: "zen.trainer@progz.test" });
  assert.equal(pending.role, "trainer");
  assert.equal(pending.source, "zen");

  nock("http://zen.test").get("/api/trainers/progz").reply(200, payload);
  const second = await syncInstructors();
  assert.equal(second.syncedCount, 0);
  assert.ok(second.duplicateCount >= 1);
});
