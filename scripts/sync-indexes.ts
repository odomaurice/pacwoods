/** Creates/updates the indexes declared in the Mongoose schemas. Run on deploy. */
import mongoose from "mongoose";
import { connectDb } from "../src/server/db/connect";
import { AuditLog } from "../src/server/db/models/AuditLog";
import { AuthThrottle } from "../src/server/db/models/AuthThrottle";
import { ClientProfile } from "../src/server/db/models/ClientProfile";
import { CutlistVersion } from "../src/server/db/models/CutlistVersion";
import { Issue } from "../src/server/db/models/Issue";
import { Photo } from "../src/server/db/models/Photo";
import { JobStatusEvent } from "../src/server/db/models/JobStatusEvent";
import { Notification } from "../src/server/db/models/Notification";
import { PasswordResetToken } from "../src/server/db/models/PasswordResetToken";
import { SystemSetting } from "../src/server/db/models/SystemSetting";
import { ProcessingSession } from "../src/server/db/models/ProcessingSession";
import { ProductionTask } from "../src/server/db/models/ProductionTask";
import { Job } from "../src/server/db/models/Job";
import { Material } from "../src/server/db/models/Material";
import { User } from "../src/server/db/models/User";

async function main() {
  await connectDb();
  for (const model of [User, AuditLog, AuthThrottle, ClientProfile, Material, Job, CutlistVersion, JobStatusEvent, ProductionTask, ProcessingSession, Issue, Photo, Notification, SystemSetting, PasswordResetToken]) {
    await model.syncIndexes();
    console.log(`indexes synced: ${model.collection.collectionName}`);
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
