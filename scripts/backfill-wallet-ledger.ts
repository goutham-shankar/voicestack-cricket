import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose from "mongoose";
import TeamModel from "../src/models/Team";
import PlayerModel from "../src/models/Player";
import {
  recordTransaction,
  hasStartingBalanceEntry,
  hasPurchaseEntry,
} from "../src/lib/services/wallet-ledger";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");

  await mongoose.connect(uri);

  const teams = await TeamModel.find().lean();
  let creditsAdded = 0;
  let debitsAdded = 0;

  for (const team of teams) {
    const teamId = String(team._id);

    if (!(await hasStartingBalanceEntry(teamId))) {
      await recordTransaction({
        teamId,
        type: "CREDIT",
        amount: team.initialBudget,
        note: "Starting balance",
      });
      creditsAdded++;
    }

    const soldPlayers = await PlayerModel.find({
      soldToTeamId: team._id,
      status: "SOLD",
    })
      .sort({ updatedAt: 1 })
      .lean();

    for (const player of soldPlayers) {
      if (await hasPurchaseEntry(teamId, String(player._id))) continue;
      await recordTransaction({
        teamId,
        type: "DEBIT",
        amount: -(player.soldPrice ?? 0),
        note: `Purchased ${player.name}`,
        playerId: String(player._id),
      });
      debitsAdded++;
    }
  }

  console.log(`Backfilled ${teams.length} team(s):`);
  console.log(`  starting-balance entries added: ${creditsAdded}`);
  console.log(`  purchase entries added: ${debitsAdded}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
