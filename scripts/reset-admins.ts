import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import UserModel from "../src/models/User";

const ADMINS = [
  { email: "visakhp@voicestack.com", name: "Visakh P", password: "visakh@1223" },
  { email: "anjanarajesh@voicestack.com", name: "Anjana Rajesh", password: "anjana@1223" },
  { email: "poojaprakash@voicestack.com", name: "Pooja Prakash", password: "pooja@1223" },
  { email: "gouthamsankar@voicestack.com", name: "Goutham Sankar", password: "goutham@1223" },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");

  await mongoose.connect(uri);

  const removed = await UserModel.deleteMany({});
  console.log(`Removed ${removed.deletedCount} existing user(s)`);

  for (const a of ADMINS) {
    await UserModel.create({
      email: a.email,
      passwordHash: await bcrypt.hash(a.password, 10),
      role: "admin",
      name: a.name,
    });
    console.log(`Created admin: ${a.email} / ${a.password}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
