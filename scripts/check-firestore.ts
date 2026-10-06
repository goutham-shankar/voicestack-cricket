/**
 * Asserts the Firestore data layer and the auction service against a live
 * database, so a drifted query or a lost atomic claim fails loudly. Companion
 * to check-auction-engine.ts, which covers the pure engine.
 *
 * WIPES EVERY COLLECTION, so point it at an emulator, never a real project:
 *   firebase emulators:start --only firestore --project demo-voicestack
 *   npx tsx scripts/check-firestore.ts
 */
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_PROJECT_ID ??= "demo-voicestack";

import { Players } from "@/models/Player";
import { Teams } from "@/models/Team";
import { Users } from "@/models/User";
import { PlayerCategories } from "@/models/PlayerCategory";
import { PlayerTags } from "@/models/PlayerTag";
import { AuctionSettingsStore } from "@/models/AuctionSettings";
import { AuctionStateStore } from "@/models/AuctionState";
import { WalletTransactions } from "@/models/WalletTransaction";
import { FieldValue } from "firebase-admin/firestore";
import { getSingleton } from "@/lib/firestore";
import { isDuplicateKeyError } from "@/lib/db-errors";
import { recordTransaction, getTeamLedger, getLedgerSummary } from "@/lib/services/wallet-ledger";
import {
  getFullState,
  startAuction,
  placeBid,
  undoLastBid,
  sellToLeadingBid,
  markUnsold,
  setRound,
  requeuePlayer,
  setShowcase,
  getAllTeamsSummary,
  getTeamFinancials,
} from "@/lib/services/auction-service";
import { populatePlayers } from "@/lib/services/populate";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${ok || detail === undefined ? "" : ` → ${JSON.stringify(detail)}`}`);
}
function eq(label: string, actual: unknown, expected: unknown) {
  check(label, actual === expected, { actual, expected });
}

async function wipe() {
  await Promise.all([
    Players.deleteMany(),
    Teams.deleteMany(),
    Users.deleteMany(),
    PlayerCategories.deleteMany(),
    PlayerTags.deleteMany(),
    WalletTransactions.deleteMany(),
    AuctionStateStore.deleteMany(),
    AuctionSettingsStore.deleteMany(),
  ]);
}

async function main() {
  await wipe();

  console.log("\n— settings singleton —");
  const settings = await getSingleton(AuctionSettingsStore);
  eq("seeded with defaults", settings.bidIncrement, 500);
  eq("singleton id", settings._id, "global");
  await AuctionSettingsStore.updateById("global", { minSquadSize: 3, bidIncrement: 100 });
  eq("update sticks", (await getSingleton(AuctionSettingsStore)).minSquadSize, 3);
  eq("re-reading does not duplicate", await AuctionSettingsStore.count(), 1);

  console.log("\n— unique fields —");
  const regular = await PlayerCategories.create({ name: "Regular", defaultBasePrice: 1000, order: 0, minPerTeam: 0, maxPerTeam: null });
  const premium = await PlayerCategories.create({ name: "Premium", defaultBasePrice: 5000, order: 1, minPerTeam: 1, maxPerTeam: 1 });
  let duplicateRejected = false;
  try {
    await PlayerCategories.create({ name: "Regular", defaultBasePrice: 1, order: 9, minPerTeam: 0, maxPerTeam: null });
  } catch (err) {
    duplicateRejected = isDuplicateKeyError(err);
  }
  check("a duplicate category name is refused", duplicateRejected);
  eq("and nothing extra was written", await PlayerCategories.count(), 2);

  const tag = await PlayerTags.create({ name: "Marquee", color: "#d4a017" });

  console.log("\n— teams and the ledger —");
  const alpha = await Teams.create({ name: "Alpha", initialBudget: 50000, maxSquadSize: 5, logoUrl: null, captainMale: "A", captainFemale: "B" });
  const beta = await Teams.create({ name: "Beta", initialBudget: 50000, maxSquadSize: 5, logoUrl: null, captainMale: "C", captainFemale: "D" });
  await recordTransaction({ teamId: alpha._id, type: "CREDIT", amount: 50000, note: "Starting balance" });
  await recordTransaction({ teamId: beta._id, type: "CREDIT", amount: 50000, note: "Starting balance" });
  eq("opening balance", (await getLedgerSummary(alpha._id)).remaining, 50000);

  console.log("\n— players and reference resolution —");
  const first = await Players.create({ name: "Rohit", role: "Batsman", categoryId: regular._id, tagIds: [tag._id], info: "", avatarUrl: null, basePriceOverride: null });
  const second = await Players.create({ name: "Bumrah", role: "Bowler", categoryId: regular._id, tagIds: [], info: "", avatarUrl: null, basePriceOverride: null });
  const third = await Players.create({ name: "Hardik", role: "All-Rounder", categoryId: premium._id, tagIds: [], info: "", avatarUrl: null, basePriceOverride: null });
  const populated = await populatePlayers([first]);
  eq("category resolved", populated[0].categoryId?.name, "Regular");
  eq("tags resolved", populated[0].tagIds[0]?.name, "Marquee");
  eq("status default", first.status, "PENDING");

  console.log("\n— filters —");
  eq("$in", (await Players.find({ status: { $in: ["PENDING", "UNSOLD"] } })).length, 3);
  eq("$ne", (await Players.find({ status: { $ne: "SOLD" } })).length, 3);
  eq("$contains on an array", (await Players.find({ tagIds: { $contains: tag._id } })).length, 1);
  eq("equality + count", await Players.count({ categoryId: regular._id }), 2);
  eq("null equality", (await Players.find({ soldToTeamId: null })).length, 3);
  const sorted = await Players.find(undefined, { sort: { name: 1 } });
  eq("in-memory sort", sorted.map((p) => p.name).join(","), "Bumrah,Hardik,Rohit");
  eq("limit", (await Players.find(undefined, { sort: { name: 1 }, limit: 2 })).length, 2);

  console.log("\n— the round gate —");
  await setRound(regular._id);
  let wrongRound = "";
  try {
    await startAuction(third._id);
  } catch (err) {
    wrongRound = (err as Error).message;
  }
  check("a player from a closed round cannot open", wrongRound.includes("different round"), wrongRound);

  console.log("\n— a lot, bid by bid —");
  let state = await startAuction(first._id);
  eq("status", state.auctionState.status, "LIVE");
  eq("live player carried on the state", state.auctionState.currentPlayerId?.name, "Rohit");
  eq("category populated on the live player", state.auctionState.currentPlayerId?.categoryId?.name, "Regular");
  eq("lot counter", state.auctionState.lotNo, 1);
  eq("lot base price", state.lotBasePrice, 1000);
  eq("minimum next bid", state.minNextBid, 1000);
  eq("player marked live", (await Players.findById(first._id))?.status, "LIVE");

  let secondStart = "";
  try {
    await startAuction(second._id);
  } catch (err) {
    secondStart = (err as Error).message;
  }
  check("a second lot cannot open while one is live", Boolean(secondStart), secondStart);
  eq("and the loser is not left LIVE", (await Players.findById(second._id))?.status, "PENDING");

  state = await placeBid(alpha._id, 1000);
  eq("first bid recorded", state.auctionState.bids.length, 1);
  eq("next bid must rise", state.minNextBid, 1100);
  state = await placeBid(beta._id, 1100);
  eq("second bid recorded", state.auctionState.bids.length, 2);

  let selfRaise = "";
  try {
    await placeBid(beta._id, 1200);
  } catch (err) {
    selfRaise = (err as Error).message;
  }
  check("the leading team cannot raise itself", Boolean(selfRaise), selfRaise);

  state = await undoLastBid();
  eq("undo removes the last bid", state.auctionState.bids.length, 1);
  state = await placeBid(beta._id, 2000);

  console.log("\n— the hammer —");
  const sold = await sellToLeadingBid();
  eq("sold to the standing bid", sold.result.status, "SOLD");
  eq("at the standing amount", sold.result.status === "SOLD" ? sold.result.price : null, 2000);
  eq("to the leading team", sold.result.status === "SOLD" ? sold.result.teamName : null, "Beta");
  eq("state back to idle", sold.state.auctionState.status, "IDLE");
  eq("stamp recorded", sold.state.auctionState.lastResult?.kind, "SOLD");
  eq("stamp names the player", sold.state.auctionState.lastResult?.playerName, "Rohit");
  eq("player is sold", (await Players.findById(first._id))?.status, "SOLD");
  eq("ledger debited", (await getLedgerSummary(beta._id)).remaining, 48000);
  eq("spend tracked", (await getLedgerSummary(beta._id)).spent, 2000);
  eq("ledger has two entries", (await getTeamLedger(beta._id)).length, 2);
  eq("running balance", (await getTeamLedger(beta._id))[1].balanceAfter, 48000);
  eq("stats totalSpent", sold.state.stats.totalSpent, 2000);
  eq("stats sold", sold.state.stats.sold, 1);
  eq("recent sales", sold.state.recentSales[0]?.playerName, "Rohit");
  eq("recent sale names the buyer", sold.state.recentSales[0]?.teamName, "Beta");

  console.log("\n— unsold, then requeued —");
  await startAuction(second._id);
  const unsold = await markUnsold();
  eq("marked unsold", unsold.result.status, "UNSOLD");
  eq("player unsold", (await Players.findById(second._id))?.status, "UNSOLD");
  eq("stats unsold", unsold.state.stats.unsold, 1);
  const requeued = await requeuePlayer(second._id);
  eq("requeued to pending", (await Players.findById(second._id))?.status, "PENDING");
  eq("still re-auctionable", requeued.stats.remaining, 2);

  console.log("\n— board figures —");
  const summary = await getAllTeamsSummary();
  const betaRow = summary.find((t) => t.name === "Beta")!;
  eq("squad count", betaRow.squadCount, 1);
  eq("remaining purse", betaRow.remaining, 48000);
  eq("slots remaining", betaRow.slotsRemaining, 4);
  const financials = await getTeamFinancials(beta._id);
  eq("financials spent", financials.spent, 2000);
  eq("financials squad", financials.squadCount, 1);
  const alphaRow = requeued.teams.find((t) => t.name === "Alpha")!;
  const board = "board" in alphaRow ? alphaRow.board : null;
  check("engine limits present", board?.limit.ok === true, board?.limit);

  console.log("\n— showcase —");
  eq("showcase on", (await setShowcase(true)).auctionState.showcase, true);
  eq("showcase off", (await setShowcase(false)).auctionState.showcase, false);

  console.log("\n— a lot stays live until it is settled —");
  await startAuction(second._id);
  const stillLive = await getFullState();
  eq("still live after a read", stillLive.auctionState.status, "LIVE");
  eq("player still live", (await Players.findById(second._id))?.status, "LIVE");
  await markUnsold();
  eq("only closes when told to", (await Players.findById(second._id))?.status, "UNSOLD");

  console.log("\n— orphan repair —");
  await Players.updateById(third._id, { status: "LIVE" });
  await getFullState();
  eq("stray LIVE player reset", (await Players.findById(third._id))?.status, "PENDING");

  console.log("\n— users —");
  const user = await Users.create({ email: "a@b.com", passwordHash: "x", role: "admin", name: "Admin", teamId: null });
  let dupeUser = false;
  try {
    await Users.create({ email: "a@b.com", passwordHash: "y", role: "admin", name: "Other", teamId: null });
  } catch (err) {
    dupeUser = isDuplicateKeyError(err);
  }
  check("duplicate email refused", dupeUser);
  const renamed = await Users.updateById(user._id, { name: "Renamed" });
  eq("update returns the merged doc", renamed?.name, "Renamed");
  eq("other fields intact", renamed?.email, "a@b.com");
  check("timestamps are Dates", renamed?.updatedAt instanceof Date);
  eq("findOne by email", (await Users.findOne({ email: "a@b.com" }))?._id, user._id);
  eq("delete", await Users.deleteById(user._id), true);
  eq("delete of a missing doc", await Users.deleteById(user._id), false);

  console.log("\n— deleting a tag strips it from its players —");
  const doomed = await PlayerTags.create({ name: "Doomed", color: "#ffffff" });
  await Players.updateById(third._id, { tagIds: [tag._id, doomed._id] });
  eq("tagged", (await Players.findById(third._id))?.tagIds.length, 2);
  eq(
    "players carrying the tag are found",
    await Players.count({ tagIds: { $contains: doomed._id } }),
    1
  );
  await Players.updateMany(
    { tagIds: { $contains: doomed._id } },
    { tagIds: FieldValue.arrayRemove(doomed._id) }
  );
  const stripped = await Players.findById(third._id);
  eq("tag removed from the player", stripped?.tagIds.length, 1);
  eq("and the other tag survived", stripped?.tagIds[0], tag._id);
  eq("tag deleted", await PlayerTags.deleteById(doomed._id), true);

  console.log("\n— rounds accumulate —");
  const roundState = await setRound(premium._id);
  eq("both rounds now open", roundState.auctionState.openCategoryIds.length, 2);
  eq("current round switched", roundState.auctionState.currentCategoryId, premium._id);

  console.log(failures ? `\n${failures} check(s) FAILED\n` : "\nAll Firestore checks passed\n");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
