import { getDb } from "@/lib/firebase";
import { getSingleton, onFirestoreWrite } from "@/lib/firestore";
import { ServiceError } from "@/lib/services/service-error";
import {
  AuctionStateStore,
  type AuctionStateDoc,
  type StoredBid,
  type StoredLastResult,
} from "@/models/AuctionState";
import { AuctionSettingsStore } from "@/models/AuctionSettings";
import { Players, type PlayerDoc, type PlayerStatus } from "@/models/Player";
import { Teams, type TeamDoc } from "@/models/Team";
import { PlayerCategories, type PlayerCategoryDoc } from "@/models/PlayerCategory";
import { PlayerTags, type PlayerTagDoc } from "@/models/PlayerTag";
import type { PopulatedPlayer } from "@/lib/services/populate";
import {
  allTeamStats,
  bidLimit,
  checkBid,
  limitReason,
  fmt,
  minNextBid as engineMinNextBid,
  r2,
  type Bid,
  type EngineCategory,
  type EngineInput,
  type EnginePlayer,
  type EngineTeam,
  type TeamStats,
} from "@/lib/auction-engine";
import {
  getAllLedgerSummaries,
  getLedgerSummary,
  recordTransaction,
} from "@/lib/services/wallet-ledger";

type RuntimeSettings = {
  minSquadSize: number;
  bidIncrement: number;
  captainsCount: boolean;
};

/**
 * Everything the board is derived from, read once per request.
 *
 * Firestore has no joins and no multi-collection read, so the only way to keep
 * a board render cheap is to fetch each collection exactly once and compute
 * from memory. Before this existed the state build re-read the whole player
 * catalogue four times and the ledger twice; over a WAN each of those is a
 * round trip, and a single bid cost seconds. These seven reads are issued
 * together, so the whole snapshot costs about one round trip of latency.
 */
export type AuctionSnapshot = {
  state: AuctionStateDoc;
  settings: RuntimeSettings;
  categories: PlayerCategoryDoc[];
  tags: PlayerTagDoc[];
  teams: TeamDoc[];
  players: PlayerDoc[];
  ledgerByTeam: Map<string, { remaining: number; spent: number }>;
  categoriesById: Map<string, PlayerCategoryDoc>;
  tagsById: Map<string, PlayerTagDoc>;
  teamsById: Map<string, TeamDoc>;
  playersById: Map<string, PlayerDoc>;
};

/**
 * A snapshot costs ~112 document reads, and every client that cannot hold a
 * socket polls for one every 1.5s. Two guards keep that affordable:
 *
 *  - in-flight coalescing, so simultaneous callers share one read rather than
 *    each issuing their own;
 *  - a very short time window, well inside the poll interval, so a burst of
 *    polls costs one read instead of one each.
 *
 * Any write invalidates it immediately, so a mutation never reads back the
 * state it just replaced.
 */
const SNAPSHOT_TTL_MS = 1000;

let cachedSnapshot: { snap: AuctionSnapshot; at: number } | null = null;
let inFlightSnapshot: Promise<AuctionSnapshot> | null = null;

/** Called after every write, so the next read rebuilds from the database. */
export function invalidateSnapshot() {
  cachedSnapshot = null;
  inFlightSnapshot = null;
}

// Covers writes made anywhere in the app, not just through this service —
// an admin editing a player must show up on the board immediately.
onFirestoreWrite(invalidateSnapshot);

export async function loadSnapshot(): Promise<AuctionSnapshot> {
  if (cachedSnapshot && Date.now() - cachedSnapshot.at < SNAPSHOT_TTL_MS) {
    return cachedSnapshot.snap;
  }
  if (inFlightSnapshot) return inFlightSnapshot;

  inFlightSnapshot = readSnapshot()
    .then((snap) => {
      cachedSnapshot = { snap, at: Date.now() };
      return snap;
    })
    .finally(() => {
      inFlightSnapshot = null;
    });

  return inFlightSnapshot;
}

async function readSnapshot(): Promise<AuctionSnapshot> {
  const [state, settingsDoc, categories, tags, teams, players, ledgerByTeam] =
    await Promise.all([
      getSingleton(AuctionStateStore),
      getSingleton(AuctionSettingsStore),
      PlayerCategories.find(undefined, { sort: { order: 1, name: 1 } }),
      PlayerTags.find(undefined, { sort: { name: 1 } }),
      Teams.find(undefined, { sort: { name: 1 } }),
      Players.find(),
      getAllLedgerSummaries(),
    ]);

  return {
    state,
    settings: {
      minSquadSize: settingsDoc.minSquadSize ?? 12,
      bidIncrement: settingsDoc.bidIncrement ?? 500,
      captainsCount: settingsDoc.captainsCount ?? true,
    },
    categories,
    tags,
    teams,
    players,
    ledgerByTeam,
    categoriesById: new Map(categories.map((c) => [c._id, c])),
    tagsById: new Map(tags.map((t) => [t._id, t])),
    teamsById: new Map(teams.map((t) => [t._id, t])),
    playersById: new Map(players.map((p) => [p._id, p])),
  };
}

/** The one `auctionState/global` document, created with defaults on first read. */
function getAuctionState() {
  return getSingleton(AuctionStateStore);
}

const stateRef = () => AuctionStateStore.ref().doc("global");

/** A price is money: at most two decimal places, and above zero. */
function assertMoney(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ServiceError(`${label} must be a number`);
  }
  if (r2(value) !== value) {
    throw new ServiceError(`${label} cannot have more than two decimal places`);
  }
  if (value <= 0) throw new ServiceError(`${label} must be greater than zero`);
  return value;
}

function assertId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ServiceError(`Invalid ${label}`, 400);
  }
  return value;
}

type EngineContext = {
  input: EngineInput;
  stats: Map<string, TeamStats>;
  /** Rounds in order; the first is always open. */
  categories: EngineCategory[];
};

/**
 * Assembles the pure engine's inputs from the database. Spend comes from the
 * wallet ledger rather than being recomputed, so manual credits and debits are
 * respected: budget is set to spent + remaining, making the engine's
 * `left` equal the ledger's `remaining`.
 */
function buildEngineContext(snap: AuctionSnapshot): EngineContext {
  const categories: EngineCategory[] = snap.categories.map((c) => ({
    id: c._id,
    name: c.name,
    order: c.order ?? 0,
    basePrice: c.defaultBasePrice ?? 0,
    minPerTeam: c.minPerTeam ?? 0,
    maxPerTeam: c.maxPerTeam ?? null,
  }));

  const teams: EngineTeam[] = snap.teams.map((team) => {
    const ledger = snap.ledgerByTeam.get(team._id);
    const spent = ledger?.spent ?? 0;
    const remaining = ledger?.remaining ?? team.initialBudget;
    return {
      id: team._id,
      name: team.name,
      budget: r2(spent + remaining),
      spent,
      maxSquadSize: team.maxSquadSize ?? null,
    };
  });

  const players: EnginePlayer[] = snap.players.map((pl) => ({
    id: pl._id,
    name: pl.name,
    categoryId: pl.categoryId,
    status: pl.status as EnginePlayer["status"],
    teamId: pl.soldToTeamId ?? null,
    price: pl.soldPrice ?? null,
  }));

  // Tolerate stale ids the way the board's normalize() does.
  const known = new Set(categories.map((c) => c.id));
  const currentRaw = snap.state.currentCategoryId ?? null;

  const input: EngineInput = {
    categories,
    teams,
    players,
    settings: {
      minSquadSize: snap.settings.minSquadSize,
      bidIncrement: snap.settings.bidIncrement,
      captainsCount: snap.settings.captainsCount,
    },
    openCategoryIds: (snap.state.openCategoryIds ?? []).filter((id) =>
      known.has(id)
    ),
    currentCategoryId:
      currentRaw && known.has(currentRaw)
        ? currentRaw
        : (categories[0]?.id ?? null),
  };

  return { input, stats: allTeamStats(input), categories };
}

export async function getTeamFinancials(teamId: string) {
  const [squadCount, ledger] = await Promise.all([
    Players.count({ soldToTeamId: teamId, status: "SOLD" }),
    getLedgerSummary(teamId),
  ]);
  return { spent: ledger.spent, squadCount };
}

export async function getAllTeamsSummary(snap?: AuctionSnapshot) {
  const resolved = snap ?? (await loadSnapshot());

  const squadByTeam = new Map<string, number>();
  for (const player of resolved.players) {
    if (player.status !== "SOLD" || !player.soldToTeamId) continue;
    squadByTeam.set(
      player.soldToTeamId,
      (squadByTeam.get(player.soldToTeamId) ?? 0) + 1
    );
  }

  return resolved.teams.map((team) => {
    const squadCount = squadByTeam.get(team._id) ?? 0;
    const ledger = resolved.ledgerByTeam.get(team._id);
    const spent = ledger?.spent ?? 0;
    const remaining = ledger?.remaining ?? team.initialBudget;
    return {
      _id: team._id,
      name: team.name,
      logoUrl: team.logoUrl,
      initialBudget: team.initialBudget,
      maxSquadSize: team.maxSquadSize,
      spent,
      remaining,
      squadCount,
      slotsRemaining: team.maxSquadSize - squadCount,
      captainMale: team.captainMale ?? "",
      captainFemale: team.captainFemale ?? "",
    };
  });
}

function basePriceOf(
  player: { basePriceOverride?: number | null },
  category: PlayerCategoryDoc | null
) {
  if (player.basePriceOverride != null) return player.basePriceOverride;
  return category?.defaultBasePrice ?? 0;
}

function basePriceFor(player: PlayerDoc, snap: AuctionSnapshot) {
  if (player.basePriceOverride != null) return player.basePriceOverride;
  return snap.categoriesById.get(player.categoryId)?.defaultBasePrice ?? 0;
}

/**
 * The board's rule, enforced server-side: a team may only pay what still lets
 * it fill every remaining mandatory slot at base price, with money for rounds
 * that have not opened held back. Replaces the old flat per-slot reserve.
 */
function assertTeamCanAfford(
  ctx: EngineContext,
  teamId: string,
  categoryId: string,
  amount: number
) {
  const team = ctx.input.teams.find((item) => item.id === teamId);
  if (!team) throw new ServiceError("Team not found", 404);

  if (!ctx.categories.length) {
    // No categories configured yet, so there are no slots to reserve for.
    const stats = ctx.stats.get(teamId);
    if (stats && amount > stats.left + 1e-9) {
      throw new ServiceError(`${team.name} does not have enough wallet balance`);
    }
    return;
  }

  const limit = bidLimit(ctx.input, teamId, categoryId, ctx.stats);
  if (!limit.ok) {
    throw new ServiceError(limitReason(ctx.input, teamId, limit.code, categoryId));
  }
  if (amount > limit.max + 1e-9) {
    throw new ServiceError(`${team.name} can pay at most ${fmt(limit.max)}`);
  }
}

/**
 * Any player left LIVE other than the current lot is a crash leftover. Reads
 * the candidates from the snapshot and mends it in place, so the common case
 * (nothing to repair) costs no Firestore calls at all.
 */
async function repairOrphanLivePlayers(
  snap: AuctionSnapshot,
  currentPlayerId: string | null
) {
  const orphans = snap.players.filter(
    (player) => player.status === "LIVE" && player._id !== currentPlayerId
  );
  if (!orphans.length) return;

  await Promise.all(
    orphans.map((player) => Players.updateById(player._id, { status: "PENDING" }))
  );
  for (const orphan of orphans) orphan.status = "PENDING";
  invalidateSnapshot();
}

/** A fresh key each time, so the board replays the stamp exactly once. */
function resultKey(kind: "SOLD" | "UNSOLD", playerId: string) {
  return `${kind === "SOLD" ? "s" : "u"}-${playerId}-${Date.now()}`;
}

/**
 * Returns the state to IDLE, but only while it still points at the lot the
 * caller settled — the Firestore transaction stands in for Mongo's
 * conditional `findOneAndUpdate`. Returns null when another request got there
 * first.
 */
async function clearLiveAuctionState(
  expectedPlayerId: string | null,
  lastResult?: StoredLastResult
): Promise<AuctionStateDoc | null> {
  return getDb().runTransaction(async (txn) => {
    const snapshot = await txn.get(stateRef());
    if (!snapshot.exists) return null;

    const state = AuctionStateStore.hydrate(snapshot);
    if (state.status !== "LIVE") return null;
    if (expectedPlayerId && state.currentPlayerId !== expectedPlayerId) return null;

    const patch = {
      status: "IDLE" as const,
      currentPlayerId: null,
      bids: [],
      ...(lastResult ? { lastResult } : {}),
      updatedAt: new Date(),
    };
    txn.update(stateRef(), patch);
    return { ...state, ...patch };
  });
}

/**
 * Turns the stored state into the board's DTO: names on the last result, and
 * the open rounds normalised so the first round always reads as open.
 */
function decorateStateForBoard(snap: AuctionSnapshot, ctx: EngineContext) {
  const state = snap.state;
  const stored = state.lastResult;

  let lastResult = null;
  if (stored?.playerId) {
    // Both already in the snapshot, so naming the last result is free.
    const player = snap.playersById.get(stored.playerId);
    const team = stored.teamId ? snap.teamsById.get(stored.teamId) : null;
    if (player) {
      lastResult = {
        playerId: stored.playerId,
        playerName: player.name,
        kind: stored.kind,
        teamId: stored.teamId ?? null,
        teamName: team?.name ?? null,
        amount: stored.amount ?? null,
        key: stored.key,
      };
    }
  }

  // The engine treats the first round as always open; say so explicitly here.
  const open = new Set(ctx.input.openCategoryIds);
  if (ctx.categories.length) open.add(ctx.categories[0].id);

  const bids = state.bids ?? [];

  return {
    status: state.status,
    showcase: state.showcase ?? false,
    openCategoryIds: ctx.categories.filter((c) => open.has(c.id)).map((c) => c.id),
    currentCategoryId: ctx.input.currentCategoryId,
    bids: bids.map((bid) => ({
      teamId: bid.teamId,
      amount: bid.amount,
      at: bid.at ?? null,
    })),
    lotNo: state.lotNo ?? 0,
    lastResult,
  };
}

/** Roster order as imported, falling back to creation time for older rows. */
export function byRosterOrder(a: PlayerDoc, b: PlayerDoc) {
  const byOrder = (a.order ?? 0) - (b.order ?? 0);
  if (byOrder !== 0) return byOrder;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

/** Resolves a player's references out of the snapshot — no extra reads. */
function decorateFromSnapshot(
  player: PlayerDoc,
  snap: AuctionSnapshot
): PopulatedPlayer {
  return {
    ...player,
    categoryId: snap.categoriesById.get(player.categoryId) ?? null,
    tagIds: player.tagIds
      .map((id) => snap.tagsById.get(id))
      .filter((tag): tag is PlayerTagDoc => Boolean(tag)),
  };
}

async function buildFullState(snapshot?: AuctionSnapshot) {
  const snap = snapshot ?? (await loadSnapshot());
  const state = snap.state;

  if (state.status === "IDLE") {
    await repairOrphanLivePlayers(snap, null);
  } else if (state.currentPlayerId) {
    await repairOrphanLivePlayers(snap, state.currentPlayerId);
    const livePlayer = snap.playersById.get(state.currentPlayerId);
    if (!livePlayer || livePlayer.status === "SOLD" || livePlayer.status === "UNSOLD") {
      await clearLiveAuctionState(state.currentPlayerId);
      // Re-read, or the recursion would see the same stale snapshot forever.
      invalidateSnapshot();
      return buildFullState();
    }
  }

  const ctx = buildEngineContext(snap);
  const teamSummaries = await getAllTeamsSummary(snap);

  // One pass over the catalogue in place of Mongo's counts and $group aggregate.
  const stats = {
    totalPlayers: snap.players.length,
    sold: 0,
    unsold: 0,
    remaining: 0,
    pending: 0,
    totalSpent: 0,
    highestSale: 0,
  };
  for (const player of snap.players) {
    if (player.status === "SOLD") {
      stats.sold++;
      const price = player.soldPrice ?? 0;
      stats.totalSpent += price;
      stats.highestSale = Math.max(stats.highestSale, price);
    } else if (player.status === "UNSOLD") {
      stats.unsold++;
    } else if (player.status === "PENDING") {
      stats.pending++;
    }
  }
  stats.remaining = stats.pending + stats.unsold;

  const recentSales = snap.players
    .filter((player) => player.status === "SOLD")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 8)
    .map((player) => {
      const team = player.soldToTeamId
        ? snap.teamsById.get(player.soldToTeamId)
        : null;
      return {
        _id: player._id,
        playerName: player.name,
        avatarUrl: player.avatarUrl,
        price: player.soldPrice ?? 0,
        teamName: team?.name ?? "Unknown team",
        teamLogoUrl: team?.logoUrl ?? null,
        soldAt: player.updatedAt,
      };
    });

  const pendingPlayers = snap.players
    .filter((player) => player.status === "PENDING" || player.status === "UNSOLD")
    .sort(byRosterOrder)
    .map((player) => decorateFromSnapshot(player, snap));

  const liveRaw = state.currentPlayerId
    ? (snap.playersById.get(state.currentPlayerId) ?? null)
    : null;
  const livePlayer: PopulatedPlayer | null = liveRaw
    ? decorateFromSnapshot(liveRaw, snap)
    : null;

  // The round in play is the live lot's own category, otherwise the open round.
  const roundCategoryId =
    livePlayer?.categoryId?._id ?? ctx.input.currentCategoryId;

  const teams = teamSummaries.map((team) => {
    const teamStats = ctx.stats.get(team._id);
    if (!teamStats || !ctx.categories.length) return team;
    const limit = roundCategoryId
      ? bidLimit(ctx.input, team._id, roundCategoryId, ctx.stats)
      : null;
    return {
      ...team,
      board: {
        left: teamStats.left,
        locked: teamStats.locked,
        lockedParts: teamStats.lockedParts,
        spendable: teamStats.spendable,
        squad: teamStats.squad,
        count: teamStats.count,
        mand: teamStats.mand,
        rem: teamStats.rem,
        shortfall: teamStats.shortfall,
        limit:
          limit && limit.ok
            ? {
                ok: true as const,
                max: limit.max,
                holdAll: limit.holdAll,
                holdOpen: limit.holdOpen,
                fills: limit.fills,
              }
            : {
                ok: false as const,
                code: limit ? limit.code : "closed",
                reason:
                  limit && roundCategoryId
                    ? limitReason(ctx.input, team._id, limit.code, roundCategoryId)
                    : "No round is open.",
                max: limit ? limit.max : 0,
              },
      },
    };
  });

  const lotBasePrice = livePlayer
    ? basePriceOf(livePlayer, livePlayer.categoryId)
    : null;
  const bids: Bid[] = (state.bids ?? []).map((bid) => ({
    teamId: bid.teamId,
    amount: bid.amount,
  }));

  return {
    auctionState: {
      ...decorateStateForBoard(snap, ctx),
      // The board reads the whole live player off the state, as it did when
      // Mongoose populated `currentPlayerId`.
      currentPlayerId: livePlayer,
    },
    recentSales,
    pendingPlayers,
    teams,
    categories: ctx.categories.map((category) => ({
      _id: category.id,
      name: category.name,
      defaultBasePrice: category.basePrice,
      order: category.order,
      minPerTeam: category.minPerTeam,
      maxPerTeam: category.maxPerTeam,
    })),
    minNextBid:
      lotBasePrice == null
        ? null
        : engineMinNextBid(bids, lotBasePrice, ctx.input.settings),
    lotBasePrice,
    settings: snap.settings,
    stats,
  };
}

export async function getFullState() {
  return buildFullState(await loadSnapshot());
}

export async function startAuction(playerId: string) {
  assertId(playerId, "player id");

  const snap = await loadSnapshot();

  const player = snap.playersById.get(playerId);
  if (!player) throw new ServiceError("Player not found", 404);
  if (player.status === "SOLD") {
    throw new ServiceError("This player has already been sold");
  }
  if (player.status === "LIVE") {
    throw new ServiceError("This player is already live");
  }

  const basePrice = basePriceFor(player, snap);
  if (basePrice <= 0) {
    throw new ServiceError("Player base price must be greater than zero");
  }

  // The board auctions one round at a time.
  const roundCtx = buildEngineContext(snap);
  if (roundCtx.categories.length && roundCtx.input.currentCategoryId) {
    if (player.categoryId !== roundCtx.input.currentCategoryId) {
      const round = roundCtx.categories.find(
        (c) => c.id === roundCtx.input.currentCategoryId
      );
      throw new ServiceError(
        `${player.name} is auctioned in a different round. The ${round?.name ?? "current"} round is in play.`
      );
    }
  }

  // Claim the player first so two starts cannot put different players LIVE.
  const claimed = await claimPlayerStatus(player._id, ["PENDING", "UNSOLD"], {
    status: "LIVE",
  });
  if (!claimed) {
    throw new ServiceError("Player is not available to auction");
  }

  const claimedState = await getDb().runTransaction(async (txn) => {
    const snapshot = await txn.get(stateRef());
    if (!snapshot.exists) return null;

    const state = AuctionStateStore.hydrate(snapshot);
    if (state.status !== "IDLE") return null;

    txn.update(stateRef(), {
      status: "LIVE",
      currentPlayerId: player._id,
      bids: [],
      lastResult: null,
      lotNo: (state.lotNo ?? 0) + 1,
      updatedAt: new Date(),
    });
    return state;
  });

  if (!claimedState) {
    await Players.updateById(player._id, { status: player.status });
    throw new ServiceError("An auction is already in progress");
  }

  await repairOrphanLivePlayers(snap, player._id);

  invalidateSnapshot();
  return getFullState();
}

/**
 * Moves a player to a new status only while it still holds one of the statuses
 * the caller expects — Mongo's conditional claim, as a transaction.
 */
async function claimPlayerStatus(
  playerId: string,
  expected: PlayerStatus[],
  patch: Partial<PlayerDoc>
): Promise<PlayerDoc | null> {
  const docRef = Players.ref().doc(playerId);

  return getDb().runTransaction(async (txn) => {
    const snapshot = await txn.get(docRef);
    if (!snapshot.exists) return null;

    const player = Players.hydrate(snapshot);
    if (!expected.includes(player.status)) return null;

    txn.update(docRef, { ...patch, updatedAt: new Date() });
    return { ...player, ...patch } as PlayerDoc;
  });
}

/**
 * Admin records the final result of an offline (verbal) auction round —
 * the winning team and the hammer price — and the player is marked sold.
 */
export async function sellPlayer(
  teamId: string,
  price: number,
  snapshot?: AuctionSnapshot
) {
  assertId(teamId, "team id");
  assertMoney(price, "Sold price");

  const snap = snapshot ?? (await loadSnapshot());
  const state = snap.state;
  if (state.status !== "LIVE" || !state.currentPlayerId) {
    throw new ServiceError("No player is currently live");
  }

  const player = snap.playersById.get(state.currentPlayerId);
  if (!player) throw new ServiceError("Player not found", 404);
  if (player.status === "SOLD") throw new ServiceError("Player already sold");

  const team = snap.teamsById.get(teamId);
  if (!team) throw new ServiceError("Team not found", 404);

  const ctx = buildEngineContext(snap);
  assertTeamCanAfford(ctx, teamId, player.categoryId, price);

  const soldPlayer = await claimPlayerStatus(
    player._id,
    ["LIVE", "PENDING", "UNSOLD"],
    { status: "SOLD", soldToTeamId: teamId, soldPrice: price }
  );
  if (!soldPlayer) {
    throw new ServiceError("Could not sell player — status changed");
  }

  await recordTransaction({
    teamId,
    type: "DEBIT",
    amount: -price,
    note: `Purchased ${player.name}`,
    playerId: player._id,
  });

  const soldResult: StoredLastResult = {
    playerId: player._id,
    kind: "SOLD",
    teamId,
    amount: price,
    key: resultKey("SOLD", player._id),
  };

  const cleared = await clearLiveAuctionState(player._id, soldResult);
  if (!cleared) {
    // The state moved on under us; force it idle if it still shows this lot.
    const current = await getAuctionState();
    if (current.currentPlayerId === player._id) {
      await AuctionStateStore.updateById("global", {
        status: "IDLE",
        currentPlayerId: null,
        bids: [],
        lastResult: soldResult,
      });
    }
  }

  invalidateSnapshot();
  const fullState = await getFullState();
  return {
    state: fullState,
    result: {
      status: "SOLD" as const,
      playerName: player.name,
      playerAvatarUrl: player.avatarUrl,
      teamName: team.name,
      price,
    },
  };
}

export async function markUnsold() {
  const snap = await loadSnapshot();
  const state = snap.state;
  if (state.status !== "LIVE" || !state.currentPlayerId) {
    throw new ServiceError("No player is currently live");
  }

  const player = snap.playersById.get(state.currentPlayerId);
  if (!player) throw new ServiceError("Player not found", 404);

  const updated = await claimPlayerStatus(
    player._id,
    ["LIVE", "PENDING", "UNSOLD"],
    { status: "UNSOLD", soldToTeamId: null, soldPrice: null }
  );
  if (!updated) {
    throw new ServiceError("Could not mark player unsold");
  }

  await clearLiveAuctionState(player._id, {
    playerId: player._id,
    kind: "UNSOLD",
    teamId: null,
    amount: null,
    key: resultKey("UNSOLD", player._id),
  });

  invalidateSnapshot();
  const fullState = await getFullState();
  return {
    state: fullState,
    result: { status: "UNSOLD" as const, playerName: player.name },
  };
}

/** Turns the display board's final-squads showcase on or off. */
export async function setShowcase(enabled: boolean) {
  await getAuctionState();
  await AuctionStateStore.updateById("global", { showcase: enabled });
  invalidateSnapshot();
  return buildFullState();
}

// ---------------------------------------------------------------- the board

/** The standing bid on the current lot, or null when nobody has bid. */
function standingBid(bids: StoredBid[]): { teamId: string; amount: number } | null {
  if (!bids.length) return null;
  const last = bids[bids.length - 1];
  return { teamId: last.teamId, amount: last.amount };
}

async function requireLiveLot(snapshot?: AuctionSnapshot) {
  const snap = snapshot ?? (await loadSnapshot());
  const state = snap.state;
  if (state.status !== "LIVE" || !state.currentPlayerId) {
    throw new ServiceError("No player is currently live");
  }
  const player = snap.playersById.get(state.currentPlayerId);
  if (!player) throw new ServiceError("Player not found", 404);
  return { snap, state, player };
}

/**
 * Records a bid from a team on the current lot. Validated with the same
 * `checkBid` the board uses to decide which paddles are live, so the server
 * stays the authority.
 */
export async function placeBid(teamId: string, amount: number) {
  assertId(teamId, "team id");
  assertMoney(amount, "Bid amount");

  const { snap, state, player } = await requireLiveLot();
  const ctx = buildEngineContext(snap);
  const bids: Bid[] = (state.bids ?? []).map((bid) => ({
    teamId: bid.teamId,
    amount: bid.amount,
  }));

  const basePrice = basePriceFor(player, snap);
  const verdict = checkBid(
    ctx.input,
    bids,
    { playerId: player._id, categoryId: player.categoryId, basePrice },
    teamId,
    amount,
    ctx.stats
  );
  if (!verdict.ok) throw new ServiceError(verdict.message);

  // Guard against two bids landing at once: the ledger must not have grown.
  const appended = await getDb().runTransaction(async (txn) => {
    const snapshot = await txn.get(stateRef());
    if (!snapshot.exists) return false;

    const current = AuctionStateStore.hydrate(snapshot);
    if (current.status !== "LIVE") return false;
    if (current.currentPlayerId !== player._id) return false;
    if ((current.bids ?? []).length !== bids.length) return false;

    txn.update(stateRef(), {
      bids: [...(current.bids ?? []), { teamId, amount, at: new Date() }],
      updatedAt: new Date(),
    });
    return true;
  });

  if (!appended) {
    invalidateSnapshot();
    throw new ServiceError("Another bid landed first — check the board and try again");
  }

  invalidateSnapshot();
  return getFullState();
}

/** Takes back the most recent bid. */
export async function undoLastBid() {
  const state = await getAuctionState();
  if (state.status !== "LIVE" || !state.currentPlayerId) {
    throw new ServiceError("No player is currently live");
  }
  if (!(state.bids ?? []).length) {
    throw new ServiceError("There is no bid to undo");
  }

  await getDb().runTransaction(async (txn) => {
    const snapshot = await txn.get(stateRef());
    if (!snapshot.exists) return;

    const current = AuctionStateStore.hydrate(snapshot);
    if (current.status !== "LIVE") return;
    if (current.currentPlayerId !== state.currentPlayerId) return;
    if (!(current.bids ?? []).length) return;

    txn.update(stateRef(), {
      bids: current.bids.slice(0, -1),
      updatedAt: new Date(),
    });
  });

  invalidateSnapshot();
  return getFullState();
}

/**
 * Sells the current lot to whoever holds the standing bid. The limit is checked
 * again at the hammer, because other sales may have moved the team's purse.
 */
export async function sellToLeadingBid() {
  const { snap, state } = await requireLiveLot();
  const leading = standingBid(state.bids ?? []);
  if (!leading) {
    throw new ServiceError("No bids yet. Wait for a bid or mark the player unsold.");
  }
  return sellPlayer(leading.teamId, leading.amount, snap);
}

/**
 * Opens a round and makes it the one in play. Opening a round releases the
 * money every team had locked for it.
 */
export async function setRound(categoryId: string) {
  assertId(categoryId, "category id");

  const state = await getAuctionState();
  if (state.status === "LIVE") {
    throw new ServiceError(
      "Sell the current player or mark them unsold before switching rounds"
    );
  }

  const category = await PlayerCategories.findById(categoryId);
  if (!category) throw new ServiceError("Category not found", 404);

  const openCategoryIds = state.openCategoryIds.includes(category._id)
    ? state.openCategoryIds
    : [...state.openCategoryIds, category._id];

  await AuctionStateStore.updateById("global", {
    openCategoryIds,
    currentCategoryId: category._id,
    lastResult: null,
  });

  invalidateSnapshot();
  return getFullState();
}

/** Puts an unsold player back into the waiting pool. */
export async function requeuePlayer(playerId: string) {
  assertId(playerId, "player id");

  const updated = await claimPlayerStatus(playerId, ["UNSOLD"], {
    status: "PENDING",
    soldToTeamId: null,
    soldPrice: null,
  });
  if (!updated) {
    throw new ServiceError("That player is not in the unsold list");
  }

  invalidateSnapshot();
  return getFullState();
}
