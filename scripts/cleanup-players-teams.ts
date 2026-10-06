import { config } from "dotenv";
config({ path: ".env.local" });

import { getSingleton } from "../src/lib/firestore";
import { Players } from "../src/models/Player";
import { Teams } from "../src/models/Team";
import { Users } from "../src/models/User";
import { AuctionStateStore } from "../src/models/AuctionState";

async function main() {
  const [players, teams] = await Promise.all([
    Players.deleteMany(),
    Teams.deleteMany(),
  ]);

  const linked = await Users.find({ teamId: { $ne: null } });
  await Promise.all(linked.map((user) => Users.updateById(user._id, { teamId: null })));

  await getSingleton(AuctionStateStore);
  await AuctionStateStore.updateById("global", {
    status: "IDLE",
    currentPlayerId: null,
    timerEndsAt: null,
    timerRemainingMs: null,
    timerPaused: false,
  });

  console.log("Cleanup complete:");
  console.log(`  players deleted: ${players}`);
  console.log(`  teams deleted:   ${teams}`);
  console.log(`  users unlinked:  ${linked.length}`);
  console.log("  auction state:   IDLE (reset)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
