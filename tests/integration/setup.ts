import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { connectDb } from "@/server/db/connect";
import { AuditLog } from "@/server/db/models/AuditLog";
import { AuthThrottle } from "@/server/db/models/AuthThrottle";
import { User } from "@/server/db/models/User";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/** Integration tests run against a real replica set, in a throwaway database. */
export const hasDatabase = Boolean(process.env.MONGODB_URI);

// A readWrite Atlas user may drop collections but not databases.
async function dropAllCollections() {
  const collections = await mongoose.connection.db!.listCollections().toArray();
  for (const { name } of collections) await mongoose.connection.db!.dropCollection(name);
}

export async function connectTestDb() {
  process.env.MONGODB_DB = process.env.MONGODB_DB_TEST ?? "pacwoods_test";
  if (process.env.MONGODB_DB === "pacwoods") throw new Error("Refusing to test against the main database");
  await connectDb();
  await dropAllCollections();
  for (const model of [User, AuditLog, AuthThrottle]) await model.syncIndexes();
}

export async function disconnectTestDb() {
  await dropAllCollections();
  await mongoose.disconnect();
}
