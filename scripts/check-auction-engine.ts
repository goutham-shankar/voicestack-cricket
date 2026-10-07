/**
 * Asserts the auction engine against the VPL Auction Board's own worked
 * example, so a drifted formula fails loudly. Run: npx tsx scripts/check-auction-engine.ts
 *
 * Board config: purse 100, minimum squad 19, captains count, base R1 / S5 / P15,
 * increment 0.5, 5 teams. The board's own explainText() derives:
 *   mandatory = 15 Regular + 1 Specialist + 1 Power = 17 bought + 2 captains = 19
 *   locked at the start = 5 + 15 = 20, so spendable in round 1 = 80
 *   opening max bid for a Regular = 100 − (14×1 + 5 + 15) = 66
 */
import {
  allTeamStats,
  bidLimit,
  checkBid,
  mandatorySlots,
  minNextBid,
  teamStats,
  type EngineCategory,
  type EngineInput,
  type EnginePlayer,
  type EngineSettings,
  type EngineTeam,
} from "../src/lib/auction-engine";

let failures = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`${pass ? "  ok  " : "FAIL  "}${label}: ${actual}${pass ? "" : ` (expected ${expected})`}`);
}

const REG: EngineCategory = { id: "R", name: "Regular", order: 0, basePrice: 1, minPerTeam: 0, maxPerTeam: null };
const SPE: EngineCategory = { id: "S", name: "Specialist", order: 1, basePrice: 5, minPerTeam: 1, maxPerTeam: 1 };
const POW: EngineCategory = { id: "P", name: "Power", order: 2, basePrice: 15, minPerTeam: 1, maxPerTeam: 1 };
const categories = [REG, SPE, POW];
const settings: EngineSettings = {
  minSquadSize: 19,
  minFemalePlayers: 0,
  bidIncrement: 0.5,
  captainsCount: true,
};

function team(id: string, over: Partial<EngineTeam> = {}): EngineTeam {
  return { id, name: `Team ${id}`, budget: 100, spent: 0, maxSquadSize: null, ...over };
}
function pool(
  categoryId: string,
  n: number,
  from = 0,
  gender: "M" | "F" = "M"
): EnginePlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${categoryId}-pool-${from + i}`, name: `P${from + i}`, categoryId,
    gender, status: "PENDING" as const, teamId: null, price: null,
  }));
}
function sold(
  categoryId: string,
  n: number,
  teamId: string,
  price: number,
  gender: "M" | "F" = "M"
): EnginePlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${categoryId}-sold-${teamId}-${i}`, name: `S${i}`, categoryId,
    gender, status: "SOLD" as const, teamId, price,
  }));
}

const teams = ["A", "B", "C", "D", "E"].map((id) => team(id));
const base: EngineInput = {
  categories, teams, settings,
  players: [...pool("R", 85), ...pool("S", 6), ...pool("P", 6)],
  openCategoryIds: ["R"],
  currentCategoryId: "R",
};

console.log("\n— Mandatory slots —");
const mand = mandatorySlots(categories, settings);
eq("Regular minimum", mand.R, 15);
eq("Specialist minimum", mand.S, 1);
eq("Power minimum", mand.P, 1);
eq("players bought + captains", mand.R + mand.S + mand.P + 2, 19);

console.log("\n— Opening team stats —");
const st = teamStats(base, "A");
eq("purse left", st.left, 100);
eq("locked (S 5 + P 15)", st.locked, 20);
eq("spendable in round 1", st.spendable, 80);
eq("total needed at base", st.needTotal, 35);
eq("shortfall", st.shortfall, 0);
eq("squad (captains only)", st.squad, 2);

console.log("\n— Opening bid limit, Regular —");
const lim = bidLimit(base, "A", "R");
eq("ok", lim.ok, true);
eq("max bid", lim.max, 66);
eq("held back in total", lim.holdAll, 34);
eq("held back for open rounds", lim.holdOpen, 14);

console.log("\n— Minimum next bid —");
eq("no bids yet → lot base", minNextBid([], 1, settings), 1);
eq("after a bid of 4 → +increment", minNextBid([{ teamId: "A", amount: 4 }], 1, settings), 4.5);

console.log("\n— Refusal codes —");
const closed = bidLimit(base, "A", "S");
eq("closed (Specialist round shut)", closed.ok === false && closed.code, "closed");

const hasOne: EngineInput = {
  ...base,
  openCategoryIds: ["R", "S"],
  players: [...base.players, ...sold("S", 1, "A", 5)],
  teams: teams.map((t) => (t.id === "A" ? team("A", { spent: 5 }) : t)),
};
const has = bidLimit(hasOne, "A", "S");
eq("has (already holds its Specialist)", has.ok === false && has.code, "has");

const capped: EngineInput = { ...base, teams: teams.map((t) => (t.id === "A" ? team("A", { maxSquadSize: 18 }) : t)) };
const full = bidLimit(capped, "A", "R");
eq("full (no spare squad slot)", full.ok === false && full.code, "full");

const broke: EngineInput = { ...base, teams: teams.map((t) => (t.id === "A" ? team("A", { budget: 20 }) : t)) };
const short = bidLimit(broke, "A", "R");
eq("short (cannot afford base and finish squad)", short.ok === false && short.code, "short");

// A is done with its Regular minimum; only 20 Regulars remain but the other
// four teams still need 15 each, so A may not take an extra one.
const squeezed: EngineInput = {
  ...base,
  players: [...pool("R", 20), ...sold("R", 15, "A", 1), ...pool("S", 6), ...pool("P", 6)],
  teams: teams.map((t) => (t.id === "A" ? team("A", { spent: 15 }) : t)),
};
const reserved = bidLimit(squeezed, "A", "R");
eq("reserved (others need the players left)", reserved.ok === false && reserved.code, "reserved");

console.log("\n— checkBid —");
const stats = allTeamStats(base);
const lot = { playerId: "R-pool-0", categoryId: "R", basePrice: 1 };
eq("a bid at base is accepted", checkBid(base, [], lot, "A", 1, stats).ok, true);
eq("a bid at the max is accepted", checkBid(base, [], lot, "A", 66, stats).ok, true);
eq("a bid above the max is refused", checkBid(base, [], lot, "A", 67, stats).ok, false);
eq("a bid below base is refused", checkBid(base, [], lot, "A", 0.5, stats).ok, false);
eq(
  "the leading team cannot raise itself",
  checkBid(base, [{ teamId: "A", amount: 4 }], lot, "A", 5, stats).ok,
  false
);
eq(
  "a bid under last+increment is refused",
  checkBid(base, [{ teamId: "B", amount: 4 }], lot, "A", 4.25, stats).ok,
  false
);

console.log("\n— Filler minimum tracks what a team already holds —");
// Buying a mandatory Specialist must not change the Regular requirement.
const boughtSpecialist = mandatorySlots(categories, settings, { R: 0, S: 1, P: 0 });
eq("Regular minimum after buying its Specialist", boughtSpecialist.R, 15);

// Having filled the squad entirely, nothing more is mandatory.
const complete = mandatorySlots(categories, settings, { R: 15, S: 1, P: 1 });
eq("Regular minimum once the squad is complete", complete.R, 15);

/*
 * The case that blocked every team before this rule: categories with no
 * minimum and no maximum, where a team has bought "extras". A fixed filler
 * quota would demand 10 Beginners on top of the 4 Professionals already held,
 * needing 16 slots against a cap of 12. The requirement must instead be only
 * what is left to reach the minimum squad.
 */
const openCats: EngineCategory[] = [
  { id: "B", name: "Beginner", order: 0, basePrice: 1000, minPerTeam: 0, maxPerTeam: null },
  { id: "I", name: "Intermediate", order: 1, basePrice: 2500, minPerTeam: 0, maxPerTeam: null },
  { id: "A", name: "Advanced", order: 2, basePrice: 5000, minPerTeam: 0, maxPerTeam: null },
  { id: "R4", name: "Professional", order: 3, basePrice: 10000, minPerTeam: 0, maxPerTeam: null },
];
const openSettings: EngineSettings = {
  minSquadSize: 12,
  minFemalePlayers: 0,
  bidIncrement: 500,
  captainsCount: true,
};
const openMand = mandatorySlots(openCats, openSettings, { B: 0, I: 0, A: 0, R4: 4 });
eq("filler needs only the remaining 6, not a full 10", openMand.B, 6);

const openInput: EngineInput = {
  categories: openCats,
  teams: [{ id: "M", name: "Mumbai", budget: 100000000, spent: 81200000, maxSquadSize: 12 }],
  settings: openSettings,
  players: [...pool("B", 40), ...sold("R4", 4, "M", 20300000)],
  openCategoryIds: ["B"],
  currentCategoryId: "B",
};
const openLimit = bidLimit(openInput, "M", "B");
eq("a team holding extras can still bid", openLimit.ok, true);
eq("and its squad fits the cap", 2 + 4 + (openMand.B - 0), 12);

console.log("\n— Female-player minimum —");
const mixedSettings: EngineSettings = {
  minSquadSize: 8,
  minFemalePlayers: 5,
  bidIncrement: 1,
  captainsCount: true,
};
const mixedInput: EngineInput = {
  categories: [REG],
  teams: [team("A", { maxSquadSize: 8 })],
  settings: mixedSettings,
  players: [
    ...pool("R", 10, 0, "M"),
    ...pool("R", 10, 100, "F"),
    ...sold("R", 2, "A", 1, "M"),
  ],
  openCategoryIds: ["R"],
  currentCategoryId: "R",
};
const mixedStats = teamStats(mixedInput, "A");
eq("female captain counts toward five", mixedStats.female, 1);
eq("four auctioned female players remain", mixedStats.femaleRem, 4);
const maleLot = mixedInput.players.find((player) => player.gender === "M" && player.status !== "SOLD")!;
const maleLimit = bidLimit(mixedInput, "A", "R", undefined, {
  playerId: maleLot.id,
  gender: maleLot.gender,
});
eq(
  "male bid is blocked when all remaining slots are needed for women",
  maleLimit.ok === false && maleLimit.code,
  "female"
);
const femaleLot = mixedInput.players.find((player) => player.gender === "F")!;
eq(
  "female bid remains eligible",
  bidLimit(mixedInput, "A", "R", undefined, {
    playerId: femaleLot.id,
    gender: femaleLot.gender,
  }).ok,
  true
);

const scarceInput: EngineInput = {
  ...mixedInput,
  teams: [team("A"), team("B")],
  settings: { ...mixedSettings, minFemalePlayers: 2 },
  players: [
    ...pool("R", 10, 0, "M"),
    ...pool("R", 1, 100, "F"),
    ...sold("R", 1, "A", 1, "F"),
  ],
};
const lastFemale = scarceInput.players.find(
  (player) => player.gender === "F" && player.status !== "SOLD"
)!;
const scarceLimit = bidLimit(
  scarceInput,
  "A",
  "R",
  undefined,
  { playerId: lastFemale.id, gender: "F" }
);
eq(
  "last female player is reserved for a team still below minimum",
  scarceLimit.ok === false && scarceLimit.code,
  "female_reserved"
);

console.log(failures ? `\n${failures} check(s) FAILED\n` : "\nAll engine checks passed\n");
process.exit(failures ? 1 : 0);
