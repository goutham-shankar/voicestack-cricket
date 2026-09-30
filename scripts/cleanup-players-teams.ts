import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose from "mongoose";
import PlayerModel from "../src/models/Player";
import TeamModel from "../src/models/Team";
import AuctionStateModel from "../src/models/AuctionState";
import UserModel from "../src/models/User";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");

  await mongoose.connect(uri);

  const [players, teams, users] = await Promise.all([
    PlayerModel.deleteMany({}),
    TeamModel.deleteMany({}),
    UserModel.updateMany(
      { teamId: { $ne: null } },
      { $set: { teamId: null } }
    ),
  ]);

  await AuctionStateModel.findOneAndUpdate(
    { singleton: "global" },
    {
      $set: {
        status: "IDLE",
        currentPlayerId: null,
        timerEndsAt: null,
        timerRemainingMs: null,
        timerPaused: false,
      },
    },
    { upsert: true }
  );

  console.log("Cleanup complete:");
  console.log(`  players deleted: ${players.deletedCount}`);
  console.log(`  teams deleted:   ${teams.deletedCount}`);
  console.log(`  users unlinked:  ${users.modifiedCount}`);
  console.log("  auction state:   IDLE (reset)");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
