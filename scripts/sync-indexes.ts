/** Creates/updates the indexes declared in the Mongoose schemas. Run on deploy. */
import mongoose from "mongoose";
import { connectDb } from "../src/server/db/connect";
import { AuditLog } from "../src/server/db/models/AuditLog";
import { AuthThrottle } from "../src/server/db/models/AuthThrottle";
import { User } from "../src/server/db/models/User";

async function main() {
  await connectDb();
  for (const model of [User, AuditLog, AuthThrottle]) {
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
