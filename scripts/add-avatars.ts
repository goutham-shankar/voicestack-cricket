/**
 * Adds or replaces the avatar for individually-supplied player photos.
 *
 *   npx tsx scripts/add-avatars.ts "<image>..." [--yes]
 *
 * The sibling apply-avatars.ts rebuilds public/players/ from one directory of
 * ID cards and clears the avatar of anyone it did not match — right for a bulk
 * re-import, destructive for a one-off addition. This touches only the players
 * whose photos are passed in, and leaves every other image and record alone.
 *
 * It also resizes with sharp rather than `sips`, so it runs off a Mac.
 *
 * Images are committed to the repo rather than uploaded, because the admin
 * upload route writes to the local filesystem — read-only and ephemeral on
 * Vercel, so anything uploaded there in production is lost.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import sharp from "sharp";
import { basename, join } from "path";
import { closeDb } from "../src/lib/mongo";
import { Players } from "../src/models/Player";
import { matchAll, tokens } from "./match-avatars";

const OUT_DIR = join(process.cwd(), "public", "players");
const PUBLIC_PREFIX = "/players";
/** Longest edge, in pixels. The portrait renders at ~420px on a 1080p board. */
const MAX_EDGE = 900;

const slugOf = (name: string) => tokens(name).join("-");

async function main() {
  const apply = process.argv.includes("--yes");
  const inputs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!inputs.length) {
    throw new Error('Pass one or more image paths, e.g. "public/players/esha.jpg"');
  }

  const players = await Players.find();
  const { matches, unmatchedFiles } = matchAll(
    inputs.map((p) => basename(p)),
    players
  );
  const sourceOf = new Map(inputs.map((p) => [basename(p), p]));

  if (!apply) console.log("DRY RUN — nothing written\n");

  for (const match of matches) {
    const slug = slugOf(match.playerName);
    console.log(
      `${match.file}  ->  ${match.playerName}  (${match.how})  ->  ${PUBLIC_PREFIX}/${slug}.jpg`
    );
  }
  for (const file of unmatchedFiles) {
    console.log(`${file}  ->  NO MATCH — rename it after the player and retry`);
  }

  if (!apply) {
    console.log("\nRe-run with --yes to apply.");
    return;
  }

  let written = 0;
  for (const match of matches) {
    const slug = slugOf(match.playerName);
    const source = sourceOf.get(match.file)!;
    const out = join(OUT_DIR, `${slug}.jpg`);

    // Everything becomes JPEG: HEIC and WebP from the ID cards are not safe to
    // serve to every browser, and one extension keeps the URL derivable from
    // the player's name alone. `toBuffer` first, because the source may be the
    // very file we are about to overwrite.
    const buffer = await sharp(source)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    await sharp(buffer).toFile(out);

    const saved = await Players.updateById(match.playerId, {
      avatarUrl: `${PUBLIC_PREFIX}/${slug}.jpg`,
    });
    console.log(
      saved
        ? `wrote ${slug}.jpg and set ${match.playerName}'s avatar`
        : `wrote ${slug}.jpg but ${match.playerName} vanished mid-run`
    );
    if (saved) written++;
  }

  console.log(`\n${written} avatar(s) applied, ${unmatchedFiles.length} unmatched`);
}

main()
  .catch((err) => {
    console.error(String(err instanceof Error ? err.message : err));
    process.exitCode = 1;
  })
  .finally(() => closeDb());
