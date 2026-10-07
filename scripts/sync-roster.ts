/**
 * Reconciles the players collection against the exported player sheet, so the
 * roster the auction runs on is exactly the roster on the sheet.
 *
 *   npx tsx scripts/sync-roster.ts <roster.json> [--yes]
 *
 * Captain rows are not lots and must already be filtered out of the input.
 * Players are matched by name, case- and whitespace-insensitively: a row with
 * no match is inserted, a player with no row is deleted, and a match has its
 * role, category, base price, skill tag, sheet blurb and roster position
 * corrected. Avatars, and anything else the sheet does not carry, are kept.
 *
 * Refuses to run against an auction in progress — reset it first.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "fs";
import { closeDb } from "../src/lib/mongo";
import { Players, type PlayerRole } from "../src/models/Player";
import { PlayerCategories } from "../src/models/PlayerCategory";
import { PlayerTags } from "../src/models/PlayerTag";

const LAKH = 100_000;

type Row = { name: string; role: string; skill: string; gender: string; price: string };

/** Sheet prices are either a number of lakhs or the name of a special round. */
const SPECIAL_ROUNDS = ["Specialist", "Power Player"];
const GENERAL_ROUND = "General";

/**
 * The sheet lets people tick several roles; the app stores one. All-rounder
 * wins because it already summarises the rest, then wicket-keeping as the
 * specialist position, otherwise whichever was listed first. Mirrors
 * seed-vpl.ts so a re-seed and a sync agree.
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

function playerGender(raw: string): "M" | "F" {
  const value = raw.trim().toLowerCase();
  if (value === "f" || value === "female") return "F";
  if (value === "m" || value === "male") return "M";
  throw new Error(`Unknown gender "${raw}" in roster`);
}

const key = (name: string) => name.replace(/\s+/g, " ").trim().toLowerCase();

function sameTags(a: string[], b: string[]) {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

async function main() {
  const apply = process.argv.includes("--yes");
  const path = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!path) throw new Error("Usage: npx tsx scripts/sync-roster.ts <roster.json> [--yes]");

  const rows: Row[] = JSON.parse(readFileSync(path, "utf8"));

  const dupes = [...new Map<string, number>(
    rows.map((r) => [key(r.name), rows.filter((x) => key(x.name) === key(r.name)).length])
  )].filter(([, n]) => n > 1);
  if (dupes.length) {
    throw new Error(`Duplicate names in the sheet: ${dupes.map(([n]) => n).join(", ")}`);
  }

  const players = await Players.find();
  const live = players.filter((p) => p.status !== "PENDING");
  if (live.length) {
    throw new Error(
      `${live.length} player(s) are not PENDING — run scripts/reset-auction.ts first`
    );
  }

  const categories = await PlayerCategories.find();
  const categoryByName = new Map(categories.map((c) => [c.name, c]));
  for (const name of [GENERAL_ROUND, ...SPECIAL_ROUNDS]) {
    if (!categoryByName.has(name)) throw new Error(`Category "${name}" is missing`);
  }
  const tags = await PlayerTags.find();
  const tagByName = new Map(tags.map((t) => [t.name, t]));

  /** What the sheet says this player should look like in the database. */
  function wanted(row: Row, order: number) {
    const special = SPECIAL_ROUNDS.find((s) => s === row.price);
    const category = categoryByName.get(special ?? GENERAL_ROUND)!;
    const tag = tagByName.get(row.skill);
    if (!tag) throw new Error(`No tag for skill level "${row.skill}" (${row.name})`);
    return {
      name: row.name.replace(/\s+/g, " ").trim(),
      order,
      role: primaryRole(row.role),
      gender: playerGender(row.gender),
      categoryId: category._id,
      // Specials are priced by the category; everyone else carries the
      // sheet's own figure, converted from lakhs to rupees.
      basePriceOverride: special ? null : Math.round(Number(row.price) * LAKH),
      tagIds: [tag._id],
      info: row.role,
    };
  }

  const byName = new Map(players.map((p) => [key(p.name), p]));
  const seen = new Set<string>();
  const inserts: ReturnType<typeof wanted>[] = [];
  const updates: { id: string; name: string; changes: Record<string, unknown> }[] = [];

  rows.forEach((row, i) => {
    const want = wanted(row, i);
    const have = byName.get(key(row.name));
    if (!have) {
      inserts.push(want);
      return;
    }
    seen.add(have._id);
    const changes: Record<string, unknown> = {};
    if (have.name !== want.name) changes.name = want.name;
    if (have.order !== want.order) changes.order = want.order;
    if (have.role !== want.role) changes.role = want.role;
    if (have.gender !== want.gender) changes.gender = want.gender;
    if (have.categoryId !== want.categoryId) changes.categoryId = want.categoryId;
    if (have.basePriceOverride !== want.basePriceOverride) {
      changes.basePriceOverride = want.basePriceOverride;
    }
    if (!sameTags(have.tagIds, want.tagIds)) changes.tagIds = want.tagIds;
    if (have.info !== want.info) changes.info = want.info;
    if (Object.keys(changes).length) updates.push({ id: have._id, name: have.name, changes });
  });

  const deletes = players.filter((p) => !seen.has(p._id));

  if (!apply) console.log("DRY RUN — nothing written\n");
  console.log(`sheet: ${rows.length} players, database: ${players.length}\n`);

  console.log(`to add (${inserts.length}):`);
  for (const p of inserts) {
    console.log(`   ${p.name} — ${p.role}, ${p.info}, base ${p.basePriceOverride ?? "category"}`);
  }
  console.log(`\nto delete (${deletes.length}):`);
  for (const p of deletes) console.log(`   ${p.name} (${p.role})`);
  console.log(`\nto correct (${updates.length}):`);
  for (const u of updates) {
    console.log(`   ${u.name}: ${Object.entries(u.changes).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")}`);
  }

  if (!apply) {
    console.log("\nRe-run with --yes to apply.");
    return;
  }

  for (const p of inserts) await Players.create(p);
  for (const u of updates) await Players.updateById(u.id, u.changes);
  for (const p of deletes) await Players.deleteById(p._id);

  const after = await Players.find();
  console.log(
    `\nadded ${inserts.length}, corrected ${updates.length}, deleted ${deletes.length} — ${after.length} player(s) in the database`
  );
}

main()
  .catch((err) => {
    console.error(String(err instanceof Error ? err.message : err));
    process.exitCode = 1;
  })
  .finally(() => closeDb());
