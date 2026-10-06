import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { Users } from "../src/models/User";

const EMAIL = process.env.SEED_AUCTIONEER_EMAIL || "auctioneer@voicestack.com";
const PASSWORD = process.env.SEED_AUCTIONEER_PASSWORD || "auction@123";
const NAME = process.env.SEED_AUCTIONEER_NAME || "Auctioneer";

async function main() {
  const email = EMAIL.toLowerCase();

  const existing = await Users.findOne({ email });
  if (existing) {
    // Re-running resets the password rather than failing, so the script stays
    // usable if the credential is forgotten before the event.
    await Users.updateById(existing._id, {
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      role: "auctioneer",
    });
    console.log(`Auctioneer updated: ${email}`);
    return;
  }

  await Users.create({
    email,
    passwordHash: await bcrypt.hash(PASSWORD, 10),
    role: "auctioneer",
    name: NAME,
    teamId: null,
  });

  console.log(`Auctioneer created: ${email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
