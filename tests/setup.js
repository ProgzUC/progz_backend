import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import { createApp } from "../app.js";
import User from "../models/User.js";

export const TEST_PASSWORD = "Password1";

let mongo;

export async function startTestApp() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  return createApp();
}

export async function stopTestApp() {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
  mongo = null;
}

export async function resetDatabase() {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

export async function createActiveUser({
  email,
  role,
  password = TEST_PASSWORD,
  name,
}) {
  return User.create({
    name: name || role,
    email: String(email).toLowerCase(),
    password: await bcrypt.hash(password, 10),
    role,
  });
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}
