import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { connectDb } from "@/server/db/connect";
import { AuditLog } from "@/server/db/models/AuditLog";
import { AuthThrottle } from "@/server/db/models/AuthThrottle";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { CutlistVersion } from "@/server/db/models/CutlistVersion";
import { Issue } from "@/server/db/models/Issue";
import { Photo } from "@/server/db/models/Photo";
import { JobStatusEvent } from "@/server/db/models/JobStatusEvent";
import { Notification } from "@/server/db/models/Notification";
import { PasswordResetToken } from "@/server/db/models/PasswordResetToken";
import { Payment } from "@/server/db/models/Payment";
import { SystemSetting } from "@/server/db/models/SystemSetting";
import { ProcessingSession } from "@/server/db/models/ProcessingSession";
import { ProductionTask } from "@/server/db/models/ProductionTask";
import { Job } from "@/server/db/models/Job";
import { Material } from "@/server/db/models/Material";
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
  for (const model of [User, AuditLog, AuthThrottle, ClientProfile, Material, Job, CutlistVersion, JobStatusEvent, ProductionTask, ProcessingSession, Issue, Photo, Notification, SystemSetting, PasswordResetToken, Payment]) await model.syncIndexes();
}

export async function disconnectTestDb() {
  await dropAllCollections();
  await mongoose.disconnect();
}

/** Records a finished-work photo for a stage, as completion now requires. */
export async function addFinishedPhoto(taskId: string, operatorId: string) {
  const { ProductionTask } = await import("@/server/db/models/ProductionTask");
  const task = await ProductionTask.findById(taskId).lean();
  await Photo.create({
    jobId: task!.jobId,
    workNumber: task!.workNumber,
    taskId: task!._id,
    kind: "FINISHED",
    storage: "gridfs",
    fileId: new mongoose.Types.ObjectId(),
    thumbId: new mongoose.Types.ObjectId(),
    uploadedBy: operatorId,
    uploaderRole: "OPERATOR",
  });
}
