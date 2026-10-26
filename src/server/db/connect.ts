import mongoose from "mongoose";

// One connection per server process. In dev, hot reloads re-evaluate this
// module, so the promise is kept on globalThis.
const globalForMongoose = globalThis as unknown as {
  pacwoodsMongoose?: Promise<typeof mongoose>;
};

export function connectDb(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  globalForMongoose.pacwoodsMongoose ??= mongoose
    .connect(uri, {
      dbName: process.env.MONGODB_DB ?? "pacwoods",
      // Indexes are created by `npm run db:indexes`, not on every boot.
      autoIndex: false,
    })
    .catch((error) => {
      globalForMongoose.pacwoodsMongoose = undefined;
      throw error;
    });

  return globalForMongoose.pacwoodsMongoose;
}
