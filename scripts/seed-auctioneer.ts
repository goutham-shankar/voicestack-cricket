import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { Users } from "../src/models/User";
import { Teams } from "../src/models/Team";

const EMAIL = process.env.SEED_AUCTIONEER_EMAIL || "auctioneer@voicestack.com";
const PASSWORD = process.env.SEED_AUCTIONEER_PASSWORD || "auction@123";
const NAME = process.env.SEED_AUCTIONEER_NAME || "Auctioneer";
/** Optional: link the login to a franchise by team name. */
const TEAM = process.env.SEED_AUCTIONEER_TEAM || "";

async function main() {
  const email = EMAIL.toLowerCase();

  let teamId: string | null = null;
  if (TEAM) {
    const team = await Teams.findOne({ name: TEAM });
    if (!team) throw new Error(`No team named "${TEAM}"`);
    teamId = team._id;
  }

  const existing = await Users.findOne({ email });
  if (existing) {
    // Re-running resets the password rather than failing, so the script stays
    // usable if the credential is forgotten before the event.
    await Users.updateById(existing._id, {
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      role: "auctioneer",
      ...(teamId ? { teamId } : {}),
    });
    console.log(`Auctioneer updated: ${email}${TEAM ? ` (team: ${TEAM})` : ""}`);
    return;
  }

  await Users.create({
    email,
    passwordHash: await bcrypt.hash(PASSWORD, 10),
    role: "auctioneer",
    name: NAME,
    teamId,
  });

  console.log(`Auctioneer created: ${email}${TEAM ? ` (team: ${TEAM})` : ""}`);
  if (!teamId) {
    console.log(
      'No team linked — assign one in Admin → Users, or re-run with SEED_AUCTIONEER_TEAM="<team name>".'
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
