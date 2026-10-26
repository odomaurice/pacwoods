import { connectDb } from "../src/server/db/connect";

async function main() {
  const m = await connectDb();
  const hello = await m.connection.db!.admin().command({ hello: 1 });
  console.log("connected; replica set:", hello.setName ?? "(none)", "db:", m.connection.name);
  await m.disconnect();
}

main().catch((error) => {
  console.error("connection failed:", error.message);
  process.exit(1);
});
