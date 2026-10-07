/**
 * Builds each team's crest from its two captains' ID-card photos, side by side,
 * and points Team.logoUrl at it.
 *
 *   npx tsx scripts/apply-team-crests.ts "<image dir>" [--dry-run]
 *
 * The canvas is square, split down the middle, because every place a crest is
 * shown renders it through Avatar — `aspect-square` with `object-cover`, often
 * `rounded-full`. A wide strip would have both faces cropped off at the edges;
 * a split square reads as two people in a circle and in a rounded box alike.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { execFileSync } from "child_process";
import { mkdirSync, readdirSync, rmSync, existsSync } from "fs";
import { extname, join } from "path";
import { tmpdir } from "os";
import { closeDb } from "../src/lib/mongo";
import { Teams } from "../src/models/Team";
import { tokens, labelOf } from "./match-avatars";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);
const OUT_DIR = join(process.cwd(), "public", "teams");
const PUBLIC_PREFIX = "/teams";

/** Half the square, so each captain gets a 1:2 panel. */
const SIZE = 512;
const HALF = SIZE / 2;

/**
 * The seam between the two captains is a lightning bolt rather than a straight
 * line, so each panel is cut wider than half and the two overlap across the
 * middle. The bolt is then drawn inside that overlap, which means neither
 * captain runs out of photo wherever the seam happens to wander.
 */
const BOLT_AMPLITUDE = 32;
const PANEL_W = HALF + 2 * BOLT_AMPLITUDE;

/** The bolt, top to bottom, zig-zagging either side of the midline. */
const BOLT: [number, number][] = [
  [HALF + BOLT_AMPLITUDE, 0],
  [HALF - 24, 150],
  [HALF + 24, 195],
  [HALF - BOLT_AMPLITUDE, 345],
  [HALF + 16, 392],
  [HALF - 20, SIZE],
];

const boltPath = BOLT.map(([x, y]) => `${x},${y}`).join(" ");

/** How much of each photo, from the top, the panel is built from by default. */
const TOP_FRACTION = 0.62;

/**
 * Per-captain framing, for the photos the default rule gets wrong. There is no
 * face detection here, so the default assumes a subject centred horizontally in
 * a photo with some headroom; these are the ones that are not.
 *
 *   keep   — fraction of the photo's height to use. Raise it towards 1 for an
 *            already-tight headshot that the default crops into.
 *   fromY  — where that window sits vertically: 0 the top, 1 the bottom. For a
 *            subject standing low in the frame.
 *   shiftX — move the crop window sideways, as a percentage of the slack, for a
 *            subject standing off to one side. Negative is left.
 */
const FRAMING: Record<string, { keep?: number; fromY?: number; shiftX?: number }> = {
  "Adith S Kumar": { shiftX: 60 },
  "Arya K": { keep: 1 },
  "Linta Mathew": { keep: 0.56, fromY: 0.68, shiftX: 8 },
};

/**
 * Captains are recorded on the team by the name the sheet used, which does not
 * always match the ID card's. Only genuinely different spellings belong here —
 * initials and dropped middle names are handled by the token comparison.
 */
const ALIASES: Record<string, string> = {
  "Adith S Kumar": "Adith Sivakumar",
};

function key(name: string): string {
  return tokens(ALIASES[name] ?? name).join("");
}

function slugOf(name: string): string {
  return tokens(name).join("-");
}

function findImage(captain: string, files: string[]): string | null {
  const want = key(captain);
  const hits = files.filter((f) => key(labelOf(f)) === want);
  return hits.length === 1 ? hits[0] : null;
}

/** Pixel dimensions of an image, after any EXIF rotation is applied. */
function measure(file: string): [number, number] {
  const out = execFileSync("magick", [file, "-auto-orient", "-format", "%w %h", "info:"], {
    encoding: "utf8",
  }).trim().split(" ").map(Number);
  return [out[0], out[1]];
}

/**
 * One captain's panel.
 *
 * The ID cards mix headshots with full-length photos, so filling the 1:2 panel
 * from the whole frame leaves some faces too small to read at the 32px the
 * crest is drawn at in the team list. Trimming to the upper part of the photo
 * first — where heads are, whatever the framing — brings every face to roughly
 * the same size before the panel is filled.
 */
function panel(source: string, out: string, scratch: string, captain: string) {
  const framing = FRAMING[captain] ?? {};
  const keep = framing.keep ?? TOP_FRACTION;
  const filled = join(scratch, `fill-${slugOf(captain)}.png`);

  // Absolute pixels, not a percentage geometry: ImageMagick ignores the Y
  // offset of a percentage crop under -gravity, which silently keeps the top
  // of every photo however `fromY` is set.
  const [srcW, srcH] = measure(source);
  const windowH = Math.round(keep * srcH);
  const offsetY = Math.round((srcH - windowH) * (framing.fromY ?? 0));

  execFileSync("magick", [
    source, "-auto-orient",
    "-crop", `${srcW}x${windowH}+0+${offsetY}`, "+repage",
    "-resize", `${PANEL_W}x${SIZE}^`,
    filled,
  ], { stdio: "pipe" });

  // Crop explicitly rather than with -extent, so the window can be nudged off
  // centre for a subject who is not standing in the middle of their photo.
  const [width] = measure(filled);

  const slack = Math.max(0, width - PANEL_W);
  const centre = slack / 2;
  const offset = Math.round(centre + (slack / 2) * ((framing.shiftX ?? 0) / 100));
  const x = Math.min(slack, Math.max(0, offset));

  execFileSync("magick", [
    filled, "-crop", `${PANEL_W}x${SIZE}+${x}+0`, "+repage", out,
  ], { stdio: "pipe" });
}

/**
 * Lays the two panels on a square canvas, overlapping across the middle, and
 * picks between them with a lightning-shaped mask — then draws the bolt itself
 * over the seam. The dark pass under the white one keeps the bolt visible
 * where it crosses a pale background.
 */
function compose(left: string, right: string, out: string, scratch: string) {
  const leftLayer = join(scratch, "left-layer.png");
  const rightLayer = join(scratch, "right-layer.png");
  const mask = join(scratch, "mask.png");
  const merged = join(scratch, "merged.png");

  execFileSync("magick", ["-size", `${SIZE}x${SIZE}`, "xc:black", left, "-geometry", "+0+0", "-composite", leftLayer], { stdio: "pipe" });
  execFileSync("magick", ["-size", `${SIZE}x${SIZE}`, "xc:black", right, "-geometry", `+${SIZE - PANEL_W}+0`, "-composite", rightLayer], { stdio: "pipe" });

  // White keeps the left captain, black the right one.
  execFileSync("magick", [
    "-size", `${SIZE}x${SIZE}`, "xc:black",
    "-fill", "white",
    "-draw", `polygon 0,0 ${boltPath} 0,${SIZE}`,
    mask,
  ], { stdio: "pipe" });

  execFileSync("magick", [rightLayer, leftLayer, mask, "-composite", merged], { stdio: "pipe" });

  execFileSync("magick", [
    merged,
    "-fill", "none",
    "-stroke", "#00000066", "-strokewidth", "11", "-draw", `polyline ${boltPath}`,
    "-stroke", "white", "-strokewidth", "6", "-draw", `polyline ${boltPath}`,
    "-quality", "88",
    out,
  ], { stdio: "pipe" });
}

async function main() {
  const dir = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!dir) throw new Error('Pass the image directory, e.g. "~/Downloads/ID CARD-VOICESTACK"');

  const files = readdirSync(dir).filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()));
  const teams = await Teams.find({}, { sort: { name: 1 } });

  if (!dryRun) {
    if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
    mkdirSync(OUT_DIR, { recursive: true });
  }

  let built = 0;
  const problems: string[] = [];

  for (const team of teams) {
    const pair = [team.captainMale, team.captainFemale];
    const found = pair.map((c) => (c ? findImage(c, files) : null));

    const missing = pair.filter((c, i) => !found[i]).map((c) => c || "(unnamed)");
    if (missing.length) {
      problems.push(`${team.name}: no image for ${missing.join(", ")}`);
      continue;
    }

    const slug = slugOf(team.name);
    const url = `${PUBLIC_PREFIX}/${slug}.jpg`;
    console.log(`  ${team.name.padEnd(20)} ${labelOf(found[0]!)} + ${labelOf(found[1]!)}`);

    if (dryRun) continue;

    const scratch = join(tmpdir(), `crest-${slug}`);
    mkdirSync(scratch, { recursive: true });
    const left = join(scratch, "l.png");
    const right = join(scratch, "r.png");

    panel(join(dir, found[0]!), left, scratch, team.captainMale);
    panel(join(dir, found[1]!), right, scratch, team.captainFemale);
    compose(left, right, join(OUT_DIR, `${slug}.jpg`), scratch);
    rmSync(scratch, { recursive: true, force: true });

    await Teams.updateById(team._id, { logoUrl: url });
    built++;
  }

  console.log(dryRun ? "\nDRY RUN — nothing written" : `\nbuilt ${built} crest(s) into public/teams/ and linked them`);
  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    for (const p of problems) console.log(`   ${p}`);
  }
}

main()
  .catch((err) => {
    console.error(String(err instanceof Error ? err.message : err));
    process.exitCode = 1;
  })
  .finally(() => closeDb());
