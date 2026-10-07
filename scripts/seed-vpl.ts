/**
 * Seeds the VoiceStack Premier League from the exported player sheets.
 *
 *   npx tsx scripts/seed-vpl.ts "<Male.csv>" "<Female.csv>" [--force] [--test-player]
 *
 * Rows flagged "Captain" in the base-price column are not auction lots — they
 * become the captains on their team, matched to it by first name. Everyone
 * else becomes a player, filed into a category named after their base price.
 * Players keep the order they appear in, sheet by sheet.
 *
 * Refuses to run against a database that already holds players or teams unless
 * --force is given, which first clears players, teams, categories, tags and the
 * wallet ledger. User logins are never touched.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "fs";
import { closeDb } from "../src/lib/mongo";
import { getSingleton } from "../src/lib/db";
import { Players, type PlayerRole } from "../src/models/Player";
import { Teams } from "../src/models/Team";
import { Users } from "../src/models/User";
import { PlayerCategories } from "../src/models/PlayerCategory";
import { PlayerTags } from "../src/models/PlayerTag";
import { WalletTransactions } from "../src/models/WalletTransaction";
import { AuctionStateStore } from "../src/models/AuctionState";
import { AuctionSettingsStore } from "../src/models/AuctionSettings";
import { recordTransaction } from "../src/lib/services/wallet-ledger";

// ------------------------------------------------------------------ config

/**
 * Money is stored in rupees, so the display board's Cr/L formatting reads
 * correctly. The sheet quotes base prices in lakhs, so each is multiplied up.
 */
const LAKH = 100_000;
const CRORE = 100 * LAKH;

const INITIAL_BUDGET = 120 * CRORE; // 12,000L per team
/**
 * 20 per squad: 16 general + 2 captains + 1 Specialist + 1 Star. The minimum
 * equals the maximum, so the engine holds every team to a complete squad and
 * reserves the money to finish it.
 */
const MAX_SQUAD_SIZE = 20;
const MIN_SQUAD_SIZE = 20;

/**
 * Bids rise in bands: 20L up to 1Cr, 50L to 4Cr, 100L beyond. The flat value
 * is only a fallback for settings written before the bands existed.
 */
const BID_INCREMENT = 20 * LAKH;
const BID_INCREMENT_TIERS = [
  { from: 0, increment: 20 * LAKH },
  { from: 100 * LAKH, increment: 50 * LAKH },
  { from: 400 * LAKH, increment: 100 * LAKH },
];

/**
 * The two special rounds are priced by the rules, not by the sheet. Their
 * base prices are what the engine holds back from the opening round: a team
 * starts with 12,000L and can spend 9,500L until these rounds open.
 */
const SPECIAL_BASE_PRICE: Record<string, number> = {
  Specialist: 1000 * LAKH,
  "Power Player": 1500 * LAKH,
};

/**
 * Each team is named "<male captain> & <female captain>" by first name; the
 * full names are resolved from the Captain rows of the two sheets, so a
 * corrected sheet flows straight through on a re-run.
 */
const TEAM_NAMES = [
  "Vinay & Archa",
  "Maneesh & Arya",
  "Deepak & Nimisha",
  "Jeberson & Linta",
  "Adith & Nivya",
];

/**
 * Exactly five Specialists and five Power Players exist — one per team — so
 * both are mandatory and capped at one. Every other round is open.
 */
const SPECIAL_LIMITS: Record<string, { minPerTeam: number; maxPerTeam: number | null }> = {
  Specialist: { minPerTeam: 1, maxPerTeam: 1 },
  "Power Player": { minPerTeam: 1, maxPerTeam: 1 },
};

/** Skill level becomes a tag, so the board can show it without a schema change. */
const SKILL_COLORS: Record<string, string> = {
  Beginner: "#64748b",
  Intermediate: "#0ea5e9",
  Enthusiast: "#22c55e",
  Expert: "#d4a017",
};

/**
 * Categories the sheet implies. The numeric tiers price themselves; Specialist
 * and Power Player are labels, so they start at 0 and are priced from
 * Admin -> Configuration -> Player Categories before those rounds open.
 */
const SPECIAL_CATEGORIES = ["Specialist", "Power Player"];

/** Everyone with a price from the sheet is auctioned in this single round. */
const GENERAL_ROUND = "General";

// -------------------------------------------------------------------- csv

/** Minimal RFC 4180 reader — the sheet quotes multi-role cells. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * The sheet lets people tick several roles; the app stores one. All-rounder
 * wins because it already summarises the rest, then wicket-keeping as the
 * specialist position, otherwise whichever was listed first.
 */
function primaryRole(raw: string): PlayerRole {
  const parts = raw.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (parts.some((p) => p.startsWith("all"))) return "All-Rounder";
  if (parts.some((p) => p.startsWith("wicket"))) return "Wicket-Keeper";
  for (const part of parts) {
    if (part.startsWith("bat")) return "Batsman";
    if (part.startsWith("bowl")) return "Bowler";
  }
  return "Batsman";
}

// ------------------------------------------------------------------- main

type Row = { name: string; role: string; skill: string; price: string };

function readSheet(path: string): Row[] {
  const rows = parseCsv(readFileSync(path, "utf8"));
  const header = rows[0].map((h) => h.trim());
  const col = (name: string) => {
    const i = header.findIndex((h) => h === name);
    if (i === -1) throw new Error(`Column "${name}" not found in ${path}`);
    return i;
  };
  const NAME = col("Employee Name");
  const ROLE = col("Playing Role");
  const SKILL = col("Cricket Skill Level");
  const PRICE = col("Base Price in Lakhs");

  return rows
    .slice(1)
    .filter((r) => (r[NAME] ?? "").trim())
    .map((r) => ({
      name: r[NAME].trim(),
      role: (r[ROLE] ?? "").trim(),
      skill: (r[SKILL] ?? "").trim(),
      price: (r[PRICE] ?? "").trim(),
    }));
}

/** The Captain row whose name begins with the first name used in the team title. */
function findCaptain(captains: Row[], firstName: string, team: string, which: string) {
  const matches = captains.filter(
    (c) => c.name.toLowerCase().startsWith(firstName.toLowerCase())
  );
  if (matches.length === 0) {
    throw new Error(`No ${which} Captain row starting with "${firstName}" for ${team}`);
  }
  if (matches.length > 1) {
    throw new Error(
      `"${firstName}" (${team}) matches several ${which} captains: ${matches.map((m) => m.name).join(", ")}`
    );
  }
  return matches[0].name;
}

async function main() {
  const flags = new Set(["--force", "--test-player"]);
  const args = process.argv.slice(2).filter((a) => !flags.has(a));
  const force = process.argv.includes("--force");
  const withTestPlayer = process.argv.includes("--test-player");
  const [malePath, femalePath] = args;
  if (!malePath || !femalePath) {
    throw new Error("Usage: tsx scripts/seed-vpl.ts <Male.csv> <Female.csv> [--force]");
  }

  const maleRows = readSheet(malePath);
  const femaleRows = readSheet(femalePath);

  const maleCaptains = maleRows.filter((r) => r.price === "Captain");
  const femaleCaptains = femaleRows.filter((r) => r.price === "Captain");

  // Players keep each sheet's own order, male roster first.
  const lots = [
    ...maleRows
      .filter((r) => r.price !== "Captain")
      .map((row) => ({ ...row, gender: "M" as const })),
    ...femaleRows
      .filter((r) => r.price !== "Captain")
      .map((row) => ({ ...row, gender: "F" as const })),
  ];

  const TEAMS = TEAM_NAMES.map((name) => {
    const [maleFirst, femaleFirst] = name.split("&").map((p) => p.trim());
    return {
      name,
      captainMale: findCaptain(maleCaptains, maleFirst, name, "male"),
      captainFemale: findCaptain(femaleCaptains, femaleFirst, name, "female"),
    };
  });

  // Every Captain row must belong to a team, or a squad silently loses one.
  const claimed = new Set(TEAMS.flatMap((t) => [t.captainMale, t.captainFemale]));
  const orphans = [...maleCaptains, ...femaleCaptains].filter((c) => !claimed.has(c.name));
  if (orphans.length) {
    throw new Error(`Captain rows with no team: ${orphans.map((c) => c.name).join(", ")}`);
  }

  const [existingPlayers, existingTeams] = await Promise.all([
    Players.count(),
    Teams.count(),
  ]);
  if ((existingPlayers || existingTeams) && !force) {
    throw new Error(
      `Database already holds ${existingPlayers} player(s) and ${existingTeams} team(s). Re-run with --force to replace them.`
    );
  }

  if (force) {
    const linked = await Users.find({ teamId: { $ne: null } });
    await Promise.all([
      Players.deleteMany(),
      Teams.deleteMany(),
      PlayerCategories.deleteMany(),
      PlayerTags.deleteMany(),
      WalletTransactions.deleteMany(),
      ...linked.map((u) => Users.updateById(u._id, { teamId: null })),
    ]);
    await getSingleton(AuctionStateStore);
    await AuctionStateStore.updateById("global", {
      status: "IDLE", currentPlayerId: null, bids: [], lastResult: null,
      openCategoryIds: [], currentCategoryId: null, lotNo: 0,
    });
    console.log(`cleared existing data (${linked.length} login(s) unlinked)\n`);
  }

  /**
   * Three rounds. Every priced player is auctioned together in one general
   * round — the sheet's 20/30/50/75/100-lakh tiers become each player's own
   * base price rather than a round of their own — and Specialist and Power
   * Player keep a round each, because every team must take exactly one.
   */
  const specials = SPECIAL_CATEGORIES.filter((s) => lots.some((l) => l.price === s));

  const categoryIds = new Map<string, string>();
  let order = 0;

  const general = await PlayerCategories.create({
    name: GENERAL_ROUND,
    // Only applies to a player added later without a price of their own.
    defaultBasePrice: 20 * LAKH,
    order: order++,
    minPerTeam: 0,
    maxPerTeam: null,
  });
  categoryIds.set(general.name, general._id);

  for (const name of specials) {
    const limits = SPECIAL_LIMITS[name] ?? { minPerTeam: 0, maxPerTeam: null };
    const cat = await PlayerCategories.create({
      name,
      defaultBasePrice: SPECIAL_BASE_PRICE[name] ?? 0,
      order: order++,
      minPerTeam: limits.minPerTeam,
      maxPerTeam: limits.maxPerTeam,
    });
    categoryIds.set(cat.name, cat._id);
  }
  console.log(`rounds:     ${[...categoryIds.keys()].join(", ")}`);

  // --- tags from skill level ---------------------------------------------
  const tagIds = new Map<string, string>();
  for (const skill of [...new Set(lots.map((l) => l.skill).filter(Boolean))]) {
    const tag = await PlayerTags.create({
      name: skill, color: SKILL_COLORS[skill] ?? "#d4a017",
    });
    tagIds.set(skill, tag._id);
  }
  console.log(`tags:       ${[...tagIds.keys()].join(", ")}`);

  // --- teams --------------------------------------------------------------
  for (const team of TEAMS) {
    const created = await Teams.create({
      name: team.name,
      logoUrl: null,
      initialBudget: INITIAL_BUDGET,
      maxSquadSize: MAX_SQUAD_SIZE,
      captainMale: team.captainMale,
      captainFemale: team.captainFemale,
    });
    await recordTransaction({
      teamId: created._id, type: "CREDIT",
      amount: INITIAL_BUDGET, note: "Starting balance",
    });
  }
  console.log(`teams:      ${TEAMS.length}, purse ${(INITIAL_BUDGET / CRORE).toFixed(0)} Cr each`);

  // --- players ------------------------------------------------------------
  await Players.createMany(
    lots.map((lot, index) => {
      const lakhs = /^\d+$/.test(lot.price) ? Number(lot.price) : null;
      return {
        name: lot.name,
        order: index,
        role: primaryRole(lot.role),
        gender: lot.gender,
        // Priced players share the general round; the specials keep their own.
        categoryId: categoryIds.get(lakhs == null ? lot.price : GENERAL_ROUND)!,
        // The sheet's tier becomes this player's own base price.
        basePriceOverride: lakhs == null ? null : lakhs * LAKH,
        tagIds: lot.skill && tagIds.has(lot.skill) ? [tagIds.get(lot.skill)!] : [],
        // Keep the sheet's full multi-role answer; the app stores only one role.
        info: lot.role,
        avatarUrl: null,
        status: "PENDING" as const,
        soldToTeamId: null,
        soldPrice: null,
      };
    })
  );

  // --- an optional dry-run lot, last in the roster -------------------------
  if (withTestPlayer) {
    await Players.create({
      name: "ZZ Test Player",
      order: lots.length,
      role: "Batsman",
      gender: "M",
      categoryId: categoryIds.get(GENERAL_ROUND)!,
      basePriceOverride: 20 * LAKH,
      tagIds: [],
      info: "Dry-run lot — safe to sell, unsold and delete.",
    });
    console.log(`\ntest player: ZZ Test Player added to ${GENERAL_ROUND}, last in the roster`);
  }

  // --- settings -----------------------------------------------------------
  await getSingleton(AuctionSettingsStore);
  await AuctionSettingsStore.updateById("global", {
    defaultWalletBudget: INITIAL_BUDGET,
    defaultMaxSquadSize: MAX_SQUAD_SIZE,
    minSquadSize: MIN_SQUAD_SIZE,
    minFemalePlayers: 5,
    bidIncrement: BID_INCREMENT,
    bidIncrementTiers: BID_INCREMENT_TIERS,
    captainsCount: true,
  });

  const byCategory = new Map<string, number>();
  for (const lot of lots) {
    const round = /^\d+$/.test(lot.price) ? GENERAL_ROUND : lot.price;
    byCategory.set(round, (byCategory.get(round) ?? 0) + 1);
  }

  const byBasePrice = new Map<string, number>();
  for (const lot of lots.filter((l) => /^\d+$/.test(l.price))) {
    byBasePrice.set(lot.price, (byBasePrice.get(lot.price) ?? 0) + 1);
  }

  console.log(`players:    ${lots.length} (captains excluded)`);
  for (const [name, n] of byCategory) console.log(`              ${String(n).padStart(3)}  ${name}`);
  console.log(`\nbase prices inside the ${GENERAL_ROUND} round:`);
  for (const [lakhs, n] of [...byBasePrice].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`              ${String(n).padStart(3)}  ${lakhs} Lakhs`);
  }
  console.log(`\ncaptains:   ${TEAMS.length * 2}, set on their teams`);
  for (const t of TEAMS) {
    console.log(`              ${t.name.padEnd(20)} ${t.captainMale} / ${t.captainFemale}`);
  }
  for (const name of specials) {
    const price = SPECIAL_BASE_PRICE[name];
    if (!price) {
      console.log(`\nNOTE: "${name}" has no base price — set it in Admin -> Configuration.`);
    }
  }

  const held = specials.reduce((sum, n) => sum + (SPECIAL_BASE_PRICE[n] ?? 0), 0);
  console.log(`\npurse release:`);
  console.log(`  total per team          ${(INITIAL_BUDGET / LAKH).toLocaleString("en-IN")}L`);
  console.log(`  held for special rounds ${(held / LAKH).toLocaleString("en-IN")}L`);
  console.log(`  spendable in round 1    ${((INITIAL_BUDGET - held) / LAKH).toLocaleString("en-IN")}L`);

  reportSquadMaths(byCategory, [...categoryIds.keys()], TEAMS.length);
}

/**
 * The engine makes every team fill its minimum squad, charging any slots not
 * claimed by a category minimum to the FIRST round. If that round holds fewer
 * players than the teams collectively owe, the engine starts reserving players
 * for quotas that can never be met and refuses bids — the auction stalls
 * mid-round. Better to see that here than on stage.
 */
function reportSquadMaths(
  byCategory: Map<string, number>,
  /** Category names in round order — the first is where the filler lands. */
  roundOrder: string[],
  teamCount: number
) {
  const mandatoryElsewhere = Object.values(SPECIAL_LIMITS).reduce(
    (sum, limit) => sum + limit.minPerTeam,
    0
  );
  const captains = 2; // both count toward the squad
  const fillerPerTeam = MIN_SQUAD_SIZE - captains - mandatoryElsewhere;
  const fillerNeeded = fillerPerTeam * teamCount;

  const firstRound = roundOrder[0];
  const firstRoundSize = byCategory.get(firstRound) ?? 0;
  const total = [...byCategory.values()].reduce((a, b) => a + b, 0);

  console.log(`\nsquad maths (minimum squad ${MIN_SQUAD_SIZE}, max ${MAX_SQUAD_SIZE}):`);
  console.log(`  mandatory per team   ${captains} captains + ${mandatoryElsewhere} special + ${fillerPerTeam} from "${firstRound}"`);
  console.log(`  "${firstRound}" needed  ${fillerNeeded} of ${firstRoundSize} available`);
  console.log(`  total lots           ${total} for ${teamCount} x ${MAX_SQUAD_SIZE - captains} = ${teamCount * (MAX_SQUAD_SIZE - captains)} slots`);

  if (fillerNeeded > firstRoundSize) {
    console.log(
      `\n  WARNING: teams owe ${fillerNeeded} players from "${firstRound}" but only ${firstRoundSize} exist.\n` +
      `  The engine will refuse bids once the pool runs short. Lower Minimum Squad\n` +
      `  Size to ${Math.floor(firstRoundSize / teamCount) + captains + mandatoryElsewhere} or less in Admin -> Configuration.`
    );
  } else {
    console.log(`  -> every team can complete its squad`);
  }

  for (const [name, limit] of Object.entries(SPECIAL_LIMITS)) {
    const have = byCategory.get(name) ?? 0;
    if (limit.minPerTeam > 0 && have < limit.minPerTeam * teamCount) {
      console.log(
        `\n  WARNING: "${name}" is mandatory (${limit.minPerTeam} per team) but only ${have} exist for ${teamCount} teams.`
      );
    }
  }
}

main()
  .catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
  })
  .finally(() => closeDb());
