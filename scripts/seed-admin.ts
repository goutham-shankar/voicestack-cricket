import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { closeDb } from "../src/lib/mongo";
import { Users } from "../src/models/User";

const EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@auction.local";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
const NAME = process.env.SEED_ADMIN_NAME || "Auction Admin";

async function main() {
  const email = EMAIL.toLowerCase();

  const existing = await Users.findOne({ email });
  if (existing) {
    console.log(`Admin user already exists: ${EMAIL}`);
    return;
  }

  await Users.create({
    email,
    passwordHash: await bcrypt.hash(PASSWORD, 10),
    role: "admin",
    name: NAME,
  });

  console.log("Admin user created:");
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
}

main()
  .catch((err) => {
  console.error(err);
  process.exit(1);
  })
  .finally(() => closeDb());
