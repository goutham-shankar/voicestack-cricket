/**
 * Lifts the hard squad ceiling off every team and sets the squad minimum.
 *
 *   npx tsx scripts/clear-squad-caps.ts [--min 20] [--yes]
 *
 * New teams default to no ceiling, but teams created before that change still
 * carry whatever number was stored on them — so the cap would keep biting in
 * an existing database. This clears it, leaving the minimum squad size as the
 * only squad rule: teams must reach it, and nothing stops them going past.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { closeDb } from "../src/lib/mongo";
import { Teams } from "../src/models/Team";
import { AuctionSettingsStore } from "../src/models/AuctionSettings";

function flagValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

async function main() {
  const apply = process.argv.includes("--yes");
  const min = Number(flagValue("--min") ?? 20);

  if (!Number.isInteger(min) || min < 1) {
    throw new Error(`--min must be a positive whole number, got ${min}`);
  }

  const teams = await Teams.find(undefined, { sort: { name: 1 } });
  const capped = teams.filter((team) => team.maxSquadSize != null);
  const settings = await AuctionSettingsStore.findById("global");
  const currentMin = settings?.minSquadSize ?? null;

  if (!apply) console.log("DRY RUN — nothing written\n");

  console.log(`teams with a stored cap: ${capped.length} of ${teams.length}`);
  for (const team of capped) {
    console.log(`   ${team.name} — max ${team.maxSquadSize} → no limit`);
  }
  console.log(`\nminimum squad size: ${currentMin ?? "unset"} → ${min}`);

  if (!apply) {
    console.log("\nRe-run with --yes to apply.");
    return;
  }

  for (const team of capped) {
    await Teams.updateById(team._id, { maxSquadSize: null });
  }
  await AuctionSettingsStore.updateById("global", { minSquadSize: min });

  console.log(`\ncleared ${capped.length} cap(s), minimum squad size is now ${min}`);
}

main()
  .catch((err) => {
    console.error(String(err instanceof Error ? err.message : err));
    process.exitCode = 1;
  })
  .finally(() => closeDb());
