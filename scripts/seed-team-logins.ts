/**
 * Gives every team a login. Run after seed-vpl.ts:
 *
 *   npx tsx scripts/seed-team-logins.ts
 *
 * The email and password are derived from the team name, so re-running is safe
 * and prints the same credentials. An existing login has its password reset
 * rather than failing, which keeps the script usable if one is forgotten
 * before the event.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { closeDb } from "../src/lib/mongo";
import { Users } from "../src/models/User";
import { Teams } from "../src/models/Team";

const DOMAIN = process.env.SEED_TEAM_DOMAIN || "voicestack.com";
/** Matches the convention already used by the admin logins. */
const PASSWORD_SUFFIX = process.env.SEED_TEAM_PASSWORD_SUFFIX || "@1223";

/** "Vinay & Archa" -> "vinayarcha" */
function slug(teamName: string) {
  return teamName.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function main() {
  const teams = await Teams.find(undefined, { sort: { name: 1 } });
  if (!teams.length) throw new Error("No teams found — run seed-vpl.ts first");

  console.log(`${teams.length} team login(s):\n`);

  for (const team of teams) {
    const handle = slug(team.name);
    const email = `${handle}@${DOMAIN}`;
    const password = `${handle}${PASSWORD_SUFFIX}`;
    const passwordHash = await bcrypt.hash(password, 10);

    const existing = await Users.findOne({ email });
    if (existing) {
      await Users.updateById(existing._id, {
        passwordHash,
        role: "team",
        name: team.name,
        teamId: team._id,
      });
      console.log(`  updated  ${team.name.padEnd(20)} ${email.padEnd(34)} ${password}`);
    } else {
      await Users.create({
        email,
        passwordHash,
        role: "team",
        name: team.name,
        teamId: team._id,
      });
      console.log(`  created  ${team.name.padEnd(20)} ${email.padEnd(34)} ${password}`);
    }
  }

  console.log("\nShare each line with its own team only.");
}

main()
  .catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
  })
  .finally(() => closeDb());
