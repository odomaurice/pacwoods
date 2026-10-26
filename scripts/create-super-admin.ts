/**
 * Creates the first Super Admin and prints a one-time temporary password.
 *
 *   npm run create-super-admin -- --name "Jane Doe" --email jane@example.com
 *   npm run create-super-admin -- --name "Jane Doe" --phone +2348012345678
 *
 * Refuses to run if a Super Admin already exists.
 */
import { parseArgs } from "node:util";
import mongoose from "mongoose";
import { bootstrapSuperAdmin } from "../src/server/services/users";

async function main() {
  const { values } = parseArgs({
    options: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" } },
  });
  if (!values.name || (!values.email && !values.phone)) {
    console.error('Usage: npm run create-super-admin -- --name "Full Name" (--email x | --phone +234...)');
    process.exit(1);
  }

  const { user, temporaryPassword } = await bootstrapSuperAdmin({
    name: values.name,
    email: values.email,
    phone: values.phone,
  });

  console.log(`Super Admin created: ${user.name} (${user.email ?? user.phone})`);
  console.log(`Temporary password (shown once, change it at first sign-in): ${temporaryPassword}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
