/**
 * Rewinds auction progress to a clean slate, keeping teams, users, players,
 * categories and each team's starting balance.
 *
 *   npx tsx scripts/reset-auction.ts [--yes]
 *
 * Every player goes back to PENDING, the live lot is cleared, and every ledger
 * entry except the opening balance is removed — so purses return to full.
 * Nothing else is touched.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { closeDb } from "../src/lib/mongo";
import { Players } from "../src/models/Player";
import { WalletTransactions } from "../src/models/WalletTransaction";
import { AuctionStateStore } from "../src/models/AuctionState";
import { Teams } from "../src/models/Team";

const STARTING_NOTE = "Starting balance";

async function main() {
  const apply = process.argv.includes("--yes");

  const touched = await Players.find({ status: { $ne: "PENDING" } });
  const spends = (await WalletTransactions.find()).filter(
    (entry) => entry.note !== STARTING_NOTE
  );
  const teams = await Teams.find();
  const teamName = new Map(teams.map((t) => [t._id, t.name]));

  console.log(`${apply ? "" : "DRY RUN — nothing written\n"}`);
  console.log(`players to reset: ${touched.length}`);
  for (const p of touched) {
    console.log(
      `   ${p.status.padEnd(7)} ${p.name}${p.soldPrice ? `  ${p.soldPrice.toLocaleString("en-IN")}` : ""}`
    );
  }
  console.log(`\nledger entries to remove: ${spends.length}`);
  for (const e of spends) {
    console.log(`   ${e.type} ${e.amount.toLocaleString("en-IN")}  ${e.note}  (${teamName.get(e.teamId) ?? e.teamId})`);
  }

  if (!apply) {
    console.log("\nRe-run with --yes to apply.");
    return;
  }

  for (const p of touched) {
    await Players.updateById(p._id, {
      status: "PENDING",
      soldToTeamId: null,
      soldPrice: null,
    });
  }
  for (const e of spends) await WalletTransactions.deleteById(e._id);

  await AuctionStateStore.updateById("global", {
    status: "IDLE",
    currentPlayerId: null,
    bids: [],
    lastResult: null,
    lotNo: 0,
  });

  console.log(`\nreset ${touched.length} player(s), removed ${spends.length} ledger entr(ies), state is IDLE`);
}

main()
  .catch((err) => {
    console.error(String(err instanceof Error ? err.message : err));
    process.exitCode = 1;
  })
  .finally(() => closeDb());
