import { config } from "dotenv";
config({ path: ".env.local" });

import { Teams } from "../src/models/Team";
import { Players } from "../src/models/Player";
import {
  recordTransaction,
  hasStartingBalanceEntry,
  hasPurchaseEntry,
} from "../src/lib/services/wallet-ledger";

async function main() {
  const teams = await Teams.find();
  let creditsAdded = 0;
  let debitsAdded = 0;

  for (const team of teams) {
    if (!(await hasStartingBalanceEntry(team._id))) {
      await recordTransaction({
        teamId: team._id,
        type: "CREDIT",
        amount: team.initialBudget,
        note: "Starting balance",
      });
      creditsAdded++;
    }

    const soldPlayers = await Players.find(
      { soldToTeamId: team._id, status: "SOLD" },
      { sort: { updatedAt: 1 } }
    );

    for (const player of soldPlayers) {
      if (await hasPurchaseEntry(team._id, player._id)) continue;
      await recordTransaction({
        teamId: team._id,
        type: "DEBIT",
        amount: -(player.soldPrice ?? 0),
        note: `Purchased ${player.name}`,
        playerId: player._id,
      });
      debitsAdded++;
    }
  }

  console.log(`Backfilled ${teams.length} team(s):`);
  console.log(`  starting-balance entries added: ${creditsAdded}`);
  console.log(`  purchase entries added: ${debitsAdded}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
