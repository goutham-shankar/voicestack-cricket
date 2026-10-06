import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { Users } from "../src/models/User";

const ADMINS = [
  { email: "visakhp@voicestack.com", name: "Visakh P", password: "visakh@1223" },
  { email: "anjanarajesh@voicestack.com", name: "Anjana Rajesh", password: "anjana@1223" },
  { email: "poojaprakash@voicestack.com", name: "Pooja Prakash", password: "pooja@1223" },
  { email: "gouthamsankar@voicestack.com", name: "Goutham Sankar", password: "goutham@1223" },
];

async function main() {
  const removed = await Users.deleteMany();
  console.log(`Removed ${removed} existing user(s)`);

  for (const admin of ADMINS) {
    await Users.create({
      email: admin.email,
      passwordHash: await bcrypt.hash(admin.password, 10),
      role: "admin",
      name: admin.name,
    });
    console.log(`Created admin: ${admin.email} / ${admin.password}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
