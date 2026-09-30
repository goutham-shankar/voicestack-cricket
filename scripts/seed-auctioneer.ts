import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import UserModel from "../src/models/User";
import TeamModel from "../src/models/Team";

const EMAIL = process.env.SEED_AUCTIONEER_EMAIL || "auctioneer@voicestack.com";
const PASSWORD = process.env.SEED_AUCTIONEER_PASSWORD || "auction@123";
const NAME = process.env.SEED_AUCTIONEER_NAME || "Auctioneer";
/** Optional: link the login to a franchise by team name. */
const TEAM = process.env.SEED_AUCTIONEER_TEAM || "";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");

  await mongoose.connect(uri);

  const email = EMAIL.toLowerCase();

  let teamId: mongoose.Types.ObjectId | null = null;
  if (TEAM) {
    const team = await TeamModel.findOne({ name: TEAM });
    if (!team) throw new Error(`No team named "${TEAM}"`);
    teamId = team._id as mongoose.Types.ObjectId;
  }

  const existing = await UserModel.findOne({ email });
  if (existing) {
    // Re-running resets the password rather than failing, so the script stays
    // usable if the credential is forgotten before the event.
    existing.passwordHash = await bcrypt.hash(PASSWORD, 10);
    existing.role = "auctioneer";
    if (teamId) existing.teamId = teamId;
    await existing.save();
    console.log(`Auctioneer updated: ${email}${TEAM ? ` (team: ${TEAM})` : ""}`);
    await mongoose.disconnect();
    return;
  }

  await UserModel.create({
    email,
    passwordHash: await bcrypt.hash(PASSWORD, 10),
    role: "auctioneer",
    name: NAME,
    teamId,
  });

  console.log(`Auctioneer created: ${email}${TEAM ? ` (team: ${TEAM})` : ""}`);
  if (!teamId) {
    console.log(
      "No team linked — assign one in Admin → Users, or re-run with SEED_AUCTIONEER_TEAM=\"<team name>\"."
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
