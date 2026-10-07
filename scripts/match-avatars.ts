/**
 * Matches the labelled ID-card images to player records and reports the
 * pairing. Writes nothing — run scripts/apply-avatars.ts once this looks right.
 *
 *   npx tsx scripts/match-avatars.ts "<image dir>"
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readdirSync } from "fs";
import { basename, extname } from "path";
import { closeDb } from "../src/lib/mongo";
import { Players } from "../src/models/Player";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);

/**
 * The sheets and the ID cards disagree about initials: "Aravind PP" on one and
 * "Aravind P P" on the other, "Mohammed Rashid CK" against "C K". Collapsing
 * every run of single letters into one token makes the two spellings identical,
 * so the comparison can stay exact for the vast majority of names.
 */
export function tokens(name: string): string[] {
  const raw = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  const out: string[] = [];
  for (const token of raw) {
    const prev = out[out.length - 1];
    if (token.length === 1 && prev && prev.length <= 2 && /^[a-z]+$/.test(prev)) {
      out[out.length - 1] = prev + token;
    } else {
      out.push(token);
    }
  }
  return out;
}

/**
 * Sheet names that no rule can reach, because the card uses a different
 * surname entirely. Each is confirmed by the employee ID the card filename
 * carries, which the sheet also lists:
 *   Arjun S = Arjun Sathyan, both employee 12576.
 */
const ALIASES: Record<string, string> = {
  "Arjun S": "Arjun Sathyan",
};

export function key(name: string): string {
  return tokens(ALIASES[name.trim()] ?? name).join("");
}

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diag = temp;
    }
  }
  return prev[b.length];
}

/** The image label is "Full Name-EMPLOYEEID"; the id is not in the sheets. */
export function labelOf(file: string): string {
  return basename(file, extname(file)).replace(/-[A-Za-z]*\d+\s*$/, "").trim();
}

/** Are all of `short`'s tokens present in `long`, in order? */
function subsequence(short: string[], long: string[]): boolean {
  let i = 0;
  for (const t of long) if (t === short[i]) i++;
  return i === short.length;
}

export type Match = {
  file: string;
  label: string;
  playerId: string;
  playerName: string;
  how: "exact" | "prefix" | "middle" | "fuzzy";
};

/**
 * Generic over the player shape so a caller keeps the fields it passed in —
 * apply-avatars needs `avatarUrl` on the players that went unmatched.
 */
export function matchAll<P extends { _id: string; name: string }>(
  files: string[],
  players: P[]
) {
  const remaining = new Map(players.map((p) => [p._id, p]));
  const matches: Match[] = [];
  const unmatchedFiles: string[] = [];

  const candidates = files.map((file) => {
    const label = labelOf(file);
    return { file, label, label_key: key(label), label_tokens: tokens(label) };
  });

  // Strictest rule first across the whole set, so a loose rule can never steal
  // a player that an exact spelling elsewhere was going to claim.
  const passes: Match["how"][] = ["exact", "prefix", "middle", "fuzzy"];
  const taken = new Set<string>();

  for (const how of passes) {
    for (const c of candidates) {
      if (taken.has(c.file)) continue;

      const hits = [...remaining.values()].filter((p) => {
        const pk = key(p.name);
        const pt = tokens(ALIASES[p.name.trim()] ?? p.name);
        if (how === "exact") return pk === c.label_key;
        if (how === "prefix") {
          // Sheet names are often shortened: "Jeffin" for "Jeffin Idiculla
          // Alex", "Devadarsan" for "Devadarsan B". Accept only when the
          // shorter name's tokens are a leading run of the longer one's, and
          // the first name matches outright, so "Arjun S" cannot swallow an
          // unrelated Arjun.
          const [short, long] = pt.length <= c.label_tokens.length ? [pt, c.label_tokens] : [c.label_tokens, pt];
          return short.length >= 1 && short.every((t, i) => long[i] === t);
        }
        if (how === "middle") {
          // "Jacob Kurishinkal" against the card's "Jacob Jose Kurishinkal":
          // a dropped middle name, so the shorter name's tokens still appear
          // in order inside the longer one. Both ends must agree, which keeps
          // unrelated people who merely share a first name apart.
          const [short, long] = pt.length <= c.label_tokens.length ? [pt, c.label_tokens] : [c.label_tokens, pt];
          return (
            short.length >= 2 &&
            short[0] === long[0] &&
            short[short.length - 1] === long[long.length - 1] &&
            subsequence(short, long)
          );
        }
        return distance(pk, c.label_key) <= 2 && pt[0] === c.label_tokens[0];
      });

      if (hits.length === 1) {
        matches.push({
          file: c.file,
          label: c.label,
          playerId: hits[0]._id,
          playerName: hits[0].name,
          how,
        });
        remaining.delete(hits[0]._id);
        taken.add(c.file);
      }
    }
  }

  for (const c of candidates) if (!taken.has(c.file)) unmatchedFiles.push(c.file);

  return { matches, unmatchedFiles, unmatchedPlayers: [...remaining.values()] };
}

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("Pass the image directory");

  const files = readdirSync(dir).filter((f) =>
    IMAGE_EXT.has(extname(f).toLowerCase())
  );
  const players = await Players.find({}, { sort: { order: 1 } });

  const { matches, unmatchedFiles, unmatchedPlayers } = matchAll(files, players);

  const byHow = (how: string) => matches.filter((m) => m.how === how);
  console.log(`${files.length} images, ${players.length} players\n`);
  console.log(`MATCHED ${matches.length}  (exact ${byHow("exact").length}, prefix ${byHow("prefix").length}, middle ${byHow("middle").length}, fuzzy ${byHow("fuzzy").length})\n`);

  for (const how of ["prefix", "middle", "fuzzy"] as const) {
    const list = byHow(how);
    if (!list.length) continue;
    console.log(`-- ${how} matches, check these --`);
    for (const m of list) console.log(`   "${m.label}"  ->  "${m.playerName}"`);
    console.log();
  }

  console.log(`-- ${unmatchedPlayers.length} players with NO image --`);
  for (const p of unmatchedPlayers) console.log(`   ${p.name}`);
  console.log(`\n-- ${unmatchedFiles.length} images matched to nobody --`);
  for (const f of unmatchedFiles) console.log(`   ${labelOf(f)}`);
}

// Only report when run directly: scripts/apply-avatars.ts imports matchAll
// from here, and must not trigger this script's own output or its exit.
if (process.argv[1]?.endsWith("match-avatars.ts")) {
  main()
    .catch((err) => {
      console.error(String(err instanceof Error ? err.message : err));
      process.exitCode = 1;
    })
    .finally(() => closeDb());
}
