import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import UserModel from "../src/models/User";

const EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@auction.local";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
const NAME = process.env.SEED_ADMIN_NAME || "Auction Admin";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");

  await mongoose.connect(uri);

  const existing = await UserModel.findOne({ email: EMAIL.toLowerCase() });
  if (existing) {
    console.log(`Admin user already exists: ${EMAIL}`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await UserModel.create({
    email: EMAIL.toLowerCase(),
    passwordHash,
    role: "admin",
    name: NAME,
  });

  console.log("Admin user created:");
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
