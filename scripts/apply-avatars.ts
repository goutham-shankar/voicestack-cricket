/**
 * Copies the labelled ID-card images into public/players/ and points each
 * player's avatarUrl at its own. Run scripts/match-avatars.ts first to review
 * which image goes to whom.
 *
 *   npx tsx scripts/apply-avatars.ts "<image dir>" [--dry-run]
 *
 * Images are committed to the repo rather than uploaded, because the admin
 * upload route writes to the local filesystem — which is read-only and
 * ephemeral on Vercel, so anything uploaded there in production is lost.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { execFileSync } from "child_process";
import { mkdirSync, readdirSync, rmSync, existsSync } from "fs";
import { extname, join } from "path";
import { closeDb } from "../src/lib/mongo";
import { Players } from "../src/models/Player";
import { matchAll, tokens } from "./match-avatars";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);
const OUT_DIR = join(process.cwd(), "public", "players");
const PUBLIC_PREFIX = "/players";

/** Longest edge, in pixels. The portrait renders at ~420px on a 1080p board. */
const MAX_EDGE = 900;

function slugOf(name: string): string {
  return tokens(name).join("-");
}

async function main() {
  const dir = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!dir) throw new Error('Pass the image directory, e.g. "~/Downloads/ID CARD-VOICESTACK"');

  const files = readdirSync(dir).filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()));
  const players = await Players.find({}, { sort: { order: 1 } });
  const { matches, unmatchedPlayers } = matchAll(files, players);

  if (!dryRun) {
    // Rebuilt from scratch each run, so a renamed player cannot leave an
    // orphaned image behind that nothing references.
    if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
    mkdirSync(OUT_DIR, { recursive: true });
  }

  let converted = 0;
  let updated = 0;
  const failures: string[] = [];

  for (const match of matches) {
    const slug = slugOf(match.playerName);
    const url = `${PUBLIC_PREFIX}/${slug}.jpg`;

    if (!dryRun) {
      try {
        // Everything becomes JPEG: HEIC and WebP from the ID cards are not
        // safe to serve to every browser, and one extension keeps the URL
        // derivable from the player's name alone.
        execFileSync(
          "sips",
          ["-s", "format", "jpeg", "-Z", String(MAX_EDGE), join(dir, match.file), "--out", join(OUT_DIR, `${slug}.jpg`)],
          { stdio: "pipe" }
        );
        converted++;
      } catch {
        failures.push(`${match.file} (could not convert)`);
        continue;
      }

      const saved = await Players.updateById(match.playerId, { avatarUrl: url });
      if (saved) updated++;
      else failures.push(`${match.playerName} (player vanished mid-run)`);
    }
  }

  console.log(dryRun ? "\nDRY RUN — nothing written\n" : "");
  console.log(`matched   ${matches.length} of ${players.length} players`);
  if (!dryRun) {
    console.log(`converted ${converted} image(s) into public/players/`);
    console.log(`updated   ${updated} player record(s)`);
  }

  const realMissing = unmatchedPlayers.filter((p) => !p.name.startsWith("ZZ Test"));
  console.log(`\n${realMissing.length} player(s) still without an image:`);
  for (const p of realMissing) console.log(`   ${p.name}`);

  if (failures.length) {
    console.log(`\n${failures.length} failure(s):`);
    for (const f of failures) console.log(`   ${f}`);
  }
}

main()
  .catch((err) => {
    console.error(String(err instanceof Error ? err.message : err));
    process.exitCode = 1;
  })
  .finally(() => closeDb());
