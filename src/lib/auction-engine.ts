/**
 * Auction bid-limit engine — a port of the VPL Auction Board rules.
 *
 * The central rule: a team may never bid so much that it can no longer fill
 * every remaining mandatory squad slot at base price. Money earmarked for a
 * category whose round has not opened yet stays *locked* and cannot be spent
 * on the category being auctioned now.
 *
 * Everything here is pure — no Mongoose, no I/O — so the server can use it as
 * the authority and the client can use the same functions to decide which
 * paddles to disable.
 *
 * The board assumes every team fields two captains; `captainsCount` decides
 * whether they occupy mandatory squad slots.
 */

export const CAPTAINS_PER_TEAM = 2;

/** Why a team cannot bid on the current lot. */
export type BidRefusalCode =
  /** The category's round has not been opened yet. */
  | "closed"
  /** The team already holds its maximum for this category. */
  | "has"
  /** Every free squad slot is needed for mandatory players. */
  | "full"
  /** The team cannot pay the base price and still complete its squad. */
  | "short"
  /** The players left are needed for the other teams' minimums. */
  | "reserved";

export type EngineCategory = {
  id: string;
  name: string;
  order: number;
  /** Category default base price. Per-player overrides never feed reserve math. */
  basePrice: number;
  minPerTeam: number;
  /** null means unlimited. */
  maxPerTeam: number | null;
};

/**
 * How much a bid must rise by, banded by the price it is rising from — the
 * usual auction shape, where small lots move in small steps and big ones do
 * not crawl. `from` is inclusive and the bands are applied highest-first.
 */
export type BidIncrementTier = { from: number; increment: number };

export type EngineSettings = {
  minSquadSize: number;
  /** Used when no tiers are configured. */
  bidIncrement: number;
  /** When set, replaces `bidIncrement` entirely. */
  bidIncrementTiers?: BidIncrementTier[];
  captainsCount: boolean;
};

/** The step that applies to a bid standing at `amount`. */
export function incrementFor(amount: number, settings: EngineSettings): number {
  const tiers = settings.bidIncrementTiers;
  if (!tiers?.length) return settings.bidIncrement;

  let step = settings.bidIncrement;
  let best = -Infinity;
  for (const tier of tiers) {
    if (amount >= tier.from && tier.from >= best) {
      best = tier.from;
      step = tier.increment;
    }
  }
  return step;
}

export type EngineTeam = {
  id: string;
  name: string;
  budget: number;
  /** Already spent, taken from the wallet ledger. */
  spent: number;
  /** null means no cap. */
  maxSquadSize: number | null;
};

export type EnginePlayer = {
  id: string;
  name: string;
  categoryId: string;
  status: "PENDING" | "LIVE" | "SOLD" | "UNSOLD";
  teamId: string | null;
  price: number | null;
};

export type EngineInput = {
  categories: EngineCategory[];
  teams: EngineTeam[];
  players: EnginePlayer[];
  settings: EngineSettings;
  /** Categories whose round has been opened. The first category is always open. */
  openCategoryIds: string[];
  currentCategoryId: string | null;
};

export type Bid = { teamId: string; amount: number };

/** Per-category counts keyed by category id. */
type ByCategory = Record<string, number>;

export type TeamStats = {
  teamId: string;
  /** Players this team has bought, in sale order. */
  players: EnginePlayer[];
  /** How many bought, per category. */
  count: ByCategory;
  spent: number;
  /** Purse still unspent. */
  left: number;
  /** Mandatory slots, per category. */
  mand: ByCategory;
  /** Mandatory slots still unfilled, per category. */
  rem: ByCategory;
  /** Money needed to fill those slots at base price, per category. */
  need: ByCategory;
  /** Money reserved for categories whose round has not opened. */
  locked: number;
  lockedParts: { categoryId: string; amount: number }[];
  /** left − locked. */
  spendable: number;
  /** Squad size including captains when they count. */
  squad: number;
  needTotal: number;
  /** How far short of being able to complete the squad at base prices. */
  shortfall: number;
};

export type BidLimit =
  | {
      ok: true;
      max: number;
      /** Held back for every other unfilled slot. */
      holdAll: number;
      /** Of that, the part belonging to already-open categories. */
      holdOpen: number;
      /** Whether buying this player fills a mandatory slot. */
      fills: boolean;
    }
  | {
      ok: false;
      code: BidRefusalCode;
      max: number;
      holdAll?: number;
      holdOpen?: number;
      fills?: boolean;
    };

/** Rounds to 2 decimals, biased away from zero so .005 rounds up. */
export function r2(x: number): number {
  const n = Number(x);
  return Math.round(n * 100 + (n >= 0 ? 1e-7 : -1e-7)) / 100;
}

/**
 * Amount display, in this app's Indian grouping. Decimals only show when the
 * value actually has them, so whole rupees stay clean.
 */
const LAKH = 1_00_000;
const CRORE = 100 * LAKH;

/** At most two decimals, with no trailing zeros: 20, 1.5, 53.15. */
function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * Money as the room says it: 20L, 100L, 1.5Cr.
 *
 * Lakhs run to a crore inclusive, because a 100 Lakh base price is called
 * "100L" and never "1 crore"; only amounts above a crore change unit. This is
 * the one money formatter in the app — the board, the admin tables, the
 * ledgers and the display all read from here, so they cannot drift apart.
 */
export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "–";

  const value = r2(n);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs > CRORE) return `${sign}${trim(abs / CRORE)}Cr`;
  if (abs >= LAKH) return `${sign}${trim(abs / LAKH)}L`;
  if (abs >= 1000) return `${sign}${trim(abs / 1000)}K`;
  return `${sign}${trim(abs)}`;
}

/**
 * The inverse of `fmt`: reads money the way the room says it.
 *
 * Accepts what someone would actually type into a bid box — "50L", "1.5 Cr",
 * "20k", "₹50L" or a plain "5000000" — so the board can show the spoken form
 * and still take a typed correction. A bare number is rupees, matching what
 * `fmt` prints for amounts under a thousand.
 *
 * Returns null for anything it cannot read, so callers can leave the committed
 * amount alone rather than lurching to 0 mid-keystroke.
 */
export function parseMoney(input: string): number | null {
  const text = input.trim().replace(/[₹,\s]/g, "");
  if (!text) return null;

  const match = /^(-?\d*\.?\d+)(cr|c|l|k)?$/i.exec(text);
  if (!match) return null;

  const value = Number(match[1]);
  if (!isFinite(value)) return null;

  switch (match[2]?.toLowerCase()) {
    case "cr":
    case "c":
      return r2(value * CRORE);
    case "l":
      return r2(value * LAKH);
    case "k":
      return r2(value * 1000);
    default:
      return r2(value);
  }
}

/** Categories in round order. */
export function orderedCategories(categories: EngineCategory[]): EngineCategory[] {
  return [...categories].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/**
 * How many players a team must hold in each category.
 *
 * Every category beyond the first has its own fixed minimum. The lowest-order
 * category is the "filler": it supplies whatever is still missing from the
 * minimum squad size, counting the captains and everything already bought. So a
 * team that buys extras outside its minimums does not also owe a full quota of
 * filler players — it owes only what is left to reach the minimum.
 *
 * With `owned` omitted (a fresh team) this reduces to
 * `minSquadSize − captains − other minimums`, which is what the original board
 * computes for its fixed Regular/Specialist/Power set.
 *
 * An explicit minimum on the filler acts as a floor rather than being ignored.
 */
export function mandatorySlots(
  categories: EngineCategory[],
  settings: EngineSettings,
  owned?: ByCategory
): ByCategory {
  const ordered = orderedCategories(categories);
  const out: ByCategory = {};
  if (!ordered.length) return out;

  const caps = settings.captainsCount ? CAPTAINS_PER_TEAM : 0;
  const [filler, ...others] = ordered;
  const counts = owned ?? {};

  let othersRemaining = 0;
  for (const c of others) {
    const min = Math.max(0, Math.round(c.minPerTeam));
    out[c.id] = min;
    othersRemaining += Math.max(0, min - (counts[c.id] ?? 0));
  }

  const bought = ordered.reduce((total, c) => total + (counts[c.id] ?? 0), 0);
  const fillerOwned = counts[filler.id] ?? 0;

  const toReachMinimum =
    Math.round(settings.minSquadSize) - (caps + bought) - othersRemaining;
  const fillerRemaining = Math.max(
    0,
    toReachMinimum,
    Math.round(filler.minPerTeam) - fillerOwned
  );

  out[filler.id] = fillerOwned + fillerRemaining;
  return out;
}

function isOpen(input: EngineInput, categoryId: string): boolean {
  const ordered = orderedCategories(input.categories);
  // The first round is always open, mirroring the board's normalize().
  if (ordered.length && ordered[0].id === categoryId) return true;
  return input.openCategoryIds.includes(categoryId);
}

export function teamStats(input: EngineInput, teamId: string): TeamStats {
  const team = input.teams.find((t) => t.id === teamId);
  const ordered = orderedCategories(input.categories);

  const mine = input.players.filter((p) => p.status === "SOLD" && p.teamId === teamId);
  const count: ByCategory = {};
  for (const c of ordered) count[c.id] = 0;
  for (const p of mine) count[p.categoryId] = (count[p.categoryId] ?? 0) + 1;

  // The filler category's requirement depends on what this team already holds.
  const mand = mandatorySlots(input.categories, input.settings, count);

  const spent = r2(team?.spent ?? mine.reduce((a, p) => a + (p.price ?? 0), 0));
  const left = r2((team?.budget ?? 0) - spent);

  const rem: ByCategory = {};
  const need: ByCategory = {};
  const lockedParts: { categoryId: string; amount: number }[] = [];
  let needTotal = 0;
  let locked = 0;

  for (const c of ordered) {
    const r = Math.max(0, (mand[c.id] ?? 0) - (count[c.id] ?? 0));
    const n = r2(r * c.basePrice);
    rem[c.id] = r;
    need[c.id] = n;
    needTotal = r2(needTotal + n);
    if (n > 0 && !isOpen(input, c.id)) {
      lockedParts.push({ categoryId: c.id, amount: n });
      locked = r2(locked + n);
    }
  }

  const caps = input.settings.captainsCount ? CAPTAINS_PER_TEAM : 0;

  return {
    teamId,
    players: mine,
    count,
    spent,
    left,
    mand,
    rem,
    need,
    locked,
    lockedParts,
    spendable: r2(left - locked),
    squad: caps + mine.length,
    needTotal,
    shortfall: r2(Math.max(0, needTotal - left)),
  };
}

export function allTeamStats(input: EngineInput): Map<string, TeamStats> {
  return new Map(input.teams.map((t) => [t.id, teamStats(input, t.id)]));
}

/**
 * The core rule. A team's maximum bid is its purse left, minus the base price
 * of every other slot it still has to fill.
 */
export function bidLimit(
  input: EngineInput,
  teamId: string,
  categoryId: string,
  stats?: Map<string, TeamStats>
): BidLimit {
  const all = stats ?? allTeamStats(input);
  const st = all.get(teamId) ?? teamStats(input, teamId);
  const team = input.teams.find((t) => t.id === teamId);
  const cat = input.categories.find((c) => c.id === categoryId);
  if (!team || !cat) return { ok: false, code: "closed", max: 0 };

  if (!isOpen(input, categoryId)) return { ok: false, code: "closed", max: 0 };

  if (cat.maxPerTeam != null && (st.count[categoryId] ?? 0) >= cat.maxPerTeam) {
    return { ok: false, code: "has", max: 0 };
  }

  const fills = (st.rem[categoryId] ?? 0) > 0;

  if (team.maxSquadSize != null) {
    const totalRem = Object.values(st.rem).reduce((a, n) => a + n, 0);
    const after = st.squad + 1 + totalRem - (fills ? 1 : 0);
    if (after > team.maxSquadSize) return { ok: false, code: "full", max: 0 };
  }

  if (!fills) {
    // An extra, non-mandatory buy must leave enough players in this category
    // for every other team to still reach its own minimum.
    const avail = input.players.filter(
      (p) => p.categoryId === categoryId && p.status !== "SOLD"
    ).length;
    let othersNeed = 0;
    for (const t of input.teams) {
      if (t.id === teamId) continue;
      const other = all.get(t.id) ?? teamStats(input, t.id);
      othersNeed += other.rem[categoryId] ?? 0;
    }
    if (avail - 1 < othersNeed) return { ok: false, code: "reserved", max: 0 };
  }

  const holdAll = r2(st.needTotal - (fills ? cat.basePrice : 0));
  const max = r2(st.left - holdAll);
  const holdOpen = r2(holdAll - st.locked);

  if (max < cat.basePrice - 1e-9) {
    return { ok: false, code: "short", max, holdAll, holdOpen, fills };
  }
  return { ok: true, max, holdAll, holdOpen, fills };
}

export function eligibleTeams(
  input: EngineInput,
  categoryId: string,
  stats?: Map<string, TeamStats>
): EngineTeam[] {
  const all = stats ?? allTeamStats(input);
  return input.teams.filter((t) => bidLimit(input, t.id, categoryId, all).ok);
}

export function lastBid(bids: Bid[]): Bid | null {
  return bids.length ? bids[bids.length - 1] : null;
}

/**
 * The smallest acceptable next bid: one increment above the standing bid, or
 * the lot's own base price when there are no bids yet.
 */
export function minNextBid(bids: Bid[], lotBasePrice: number, settings: EngineSettings): number {
  const last = lastBid(bids);
  return last
    ? r2(last.amount + incrementFor(last.amount, settings))
    : r2(lotBasePrice);
}

export function shortReason(code: BidRefusalCode): string {
  const map: Record<BidRefusalCode, string> = {
    has: "Already has one",
    full: "Squad full",
    closed: "Round not open",
    short: "Can't afford base",
    reserved: "Others need these",
  };
  return map[code] ?? "Can't bid";
}

export function limitReason(
  input: EngineInput,
  teamId: string,
  code: BidRefusalCode,
  categoryId: string
): string {
  const team = input.teams.find((t) => t.id === teamId);
  const cat = input.categories.find((c) => c.id === categoryId);
  const name = team?.name ?? "That team";
  const label = cat?.name ?? "player";
  switch (code) {
    case "has":
      return `${name} already has its ${label}.`;
    case "full":
      return `${name} has no free slot: the rest of its squad is needed for mandatory players.`;
    case "closed":
      return `The ${label} round is not open yet.`;
    case "short":
      return `${name} can't pay the ${fmt(cat?.basePrice ?? 0)} base price and still fill its squad.`;
    case "reserved":
      return `${name} already has its minimum ${label} players. The players left are needed to complete the other squads.`;
    default:
      return `${name} can't bid on this player.`;
  }
}

export type BidCheck = { ok: true; max: number } | { ok: false; message: string };

/**
 * Validates a prospective bid. The server calls this as the authority; the
 * client calls it to decide which paddles are live.
 */
export function checkBid(
  input: EngineInput,
  bids: Bid[],
  lot: { playerId: string; categoryId: string; basePrice: number },
  teamId: string,
  amount: number,
  stats?: Map<string, TeamStats>
): BidCheck {
  const team = input.teams.find((t) => t.id === teamId);
  if (!team) return { ok: false, message: "Unknown team." };

  const amt = Number(amount);
  if (!isFinite(amt)) return { ok: false, message: "Enter a bid amount." };

  const last = lastBid(bids);
  if (last && last.teamId === teamId) {
    return { ok: false, message: `${team.name} is already leading.` };
  }

  const lim = bidLimit(input, teamId, lot.categoryId, stats);
  if (!lim.ok) {
    return { ok: false, message: limitReason(input, teamId, lim.code, lot.categoryId) };
  }

  const min = minNextBid(bids, lot.basePrice, input.settings);
  if (amt < min - 1e-9) {
    return { ok: false, message: `The next bid must be at least ${fmt(min)}.` };
  }
  if (amt > lim.max + 1e-9) {
    return { ok: false, message: `${team.name} can bid up to ${fmt(lim.max)}.` };
  }
  return { ok: true, max: lim.max };
}
