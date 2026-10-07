import { getSingleton, onDbWrite } from "@/lib/db";
import { ServiceError } from "@/lib/services/service-error";
import {
  AuctionStateStore,
  type AuctionStateDoc,
  type StoredBid,
  type StoredLastResult,
  type StoredPowerPick,
  type StoredPowerRound,
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
  type BidIncrementTier,
} from "@/lib/auction-engine";
import {
  getAllLedgerSummaries,
  getLedgerSummary,
  recordTransaction,
} from "@/lib/services/wallet-ledger";

type RuntimeSettings = {
  minSquadSize: number;
  bidIncrement: number;
  bidIncrementTiers?: BidIncrementTier[];
  captainsCount: boolean;
};

/**
 * Everything the board is derived from, read once per request.
 *
 * The board draws on every collection at once, so the way to keep a render
 * cheap is to fetch each exactly once and compute the rest in memory. Before
 * this existed the state build re-read the whole player catalogue four times
 * and the ledger twice; over a WAN each of those is a round trip, and a single
 * bid cost seconds. These seven queries are issued together, so the whole
 * snapshot costs about one round trip of latency.
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
onDbWrite(invalidateSnapshot);

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
      minSquadSize: settingsDoc.minSquadSize ?? 20,
      bidIncrement: settingsDoc.bidIncrement ?? 20 * 100_000,
      bidIncrementTiers: settingsDoc.bidIncrementTiers,
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

/** The auction state is a singleton row, keyed by this literal id. */
const STATE_ID = "global";

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
      bidIncrementTiers: snap.settings.bidIncrementTiers,
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
      slotsRemaining:
        team.maxSquadSize == null ? null : team.maxSquadSize - squadCount,
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
 * (nothing to repair) costs no database calls at all.
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
 * caller settled. One conditional `findOneAndUpdate`, so two requests racing
 * to settle the same lot cannot both win. Returns null when another request
 * got there first.
 */
async function clearLiveAuctionState(
  expectedPlayerId: string | null,
  lastResult?: StoredLastResult
): Promise<AuctionStateDoc | null> {
  return AuctionStateStore.findOneAndUpdate(
    {
      _id: STATE_ID,
      status: "LIVE",
      ...(expectedPlayerId ? { currentPlayerId: expectedPlayerId } : {}),
    },
    {
      status: "IDLE",
      currentPlayerId: null,
      bids: [],
      ...(lastResult ? { lastResult } : {}),
    }
  );
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
  const power = state.powerRound ?? {
    active: false,
    revealed: false,
    picks: [],
  };

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
    powerRound: {
      active: power.active,
      revealed: power.revealed,
      // Names are resolved here so the board never has to join picks against
      // the team list to render an offer.
      picks: power.picks.flatMap((pick) => {
        const team = snap.teamsById.get(pick.teamId);
        const player = snap.playersById.get(pick.playerId);
        if (!team || !player) return [];
        return [
          {
            teamId: pick.teamId,
            teamName: team.name,
            teamLogoUrl: team.logoUrl,
            playerId: pick.playerId,
            playerName: player.name,
            amount: pick.amount,
          },
        ];
      }),
    },
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

  // The final round shows all its players at once, including the ones already
  // won, so this cannot come from `pendingPlayers`.
  const powerCategory = powerCategoryOf(snap);
  const powerPlayers = powerCategory
    ? snap.players
        .filter((player) => player.categoryId === powerCategory._id)
        .sort(byRosterOrder)
        .map((player) => {
          const owner = player.soldToTeamId
            ? snap.teamsById.get(player.soldToTeamId)
            : null;
          return {
            _id: player._id,
            name: player.name,
            role: player.role,
            avatarUrl: player.avatarUrl,
            basePrice: basePriceOf(player, powerCategory),
            status: player.status,
            wonByTeamId: player.status === "SOLD" ? (player.soldToTeamId ?? null) : null,
            wonByTeamName: player.status === "SOLD" ? (owner?.name ?? null) : null,
            soldPrice: player.status === "SOLD" ? (player.soldPrice ?? null) : null,
          };
        })
    : [];
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
    powerPlayers,
    settings: snap.settings,
    stats,
  };
}

/**
 * A cheap signature of the board, read from the single auction-state document.
 *
 * Polling clients ask for this instead of the whole board: one document read
 * rather than the ~112 a full snapshot costs. They pull the real state only
 * when the signature moves. Every auction action — opening a lot, a bid, an
 * undo, a sale, a round change — writes this document, so the signature
 * changes with it.
 *
 * Edits made outside the auction (an admin renaming a player) do not touch it,
 * so clients also refresh in full on a slow timer as a backstop.
 */
export async function getStateVersion(): Promise<string> {
  const state = await getSingleton(AuctionStateStore);
  return [
    state.status,
    state.currentPlayerId ?? "-",
    state.lotNo ?? 0,
    (state.bids ?? []).length,
    state.lastResult?.key ?? "-",
    state.showcase ? "1" : "0",
    state.updatedAt.getTime(),
  ].join(":");
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

  // $inc rather than a read-then-write, so the lot number cannot be reused.
  const claimedState = await AuctionStateStore.findOneAndUpdate(
    { _id: STATE_ID, status: "IDLE" },
    {
      status: "LIVE",
      currentPlayerId: player._id,
      bids: [],
      lastResult: null,
      $inc: { lotNo: 1 },
    }
  );

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
  return Players.findOneAndUpdate(
    { _id: playerId, status: { $in: expected } },
    patch
  );
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

/* ------------------------------------------------------------------ *
 * The power-player round
 *
 * The final round is not called lot by lot. All the power players are on the
 * board at once; every team names one of them and what it will pay out of
 * whatever purse it has left. The highest offer takes a contested player, and
 * the teams that lost pick again from whoever is still free, until all the
 * power players are allocated.
 * ------------------------------------------------------------------ */

const POWER_CATEGORY = /power/i;

/** The category holding the power players, or null when none is configured. */
function powerCategoryOf(snap: AuctionSnapshot): PlayerCategoryDoc | null {
  return snap.categories.find((c) => POWER_CATEGORY.test(c.name)) ?? null;
}

function powerRoundOf(snap: AuctionSnapshot): StoredPowerRound {
  return snap.state.powerRound ?? { active: false, revealed: false, picks: [] };
}

async function writePowerRound(patch: Partial<StoredPowerRound>) {
  const state = await getAuctionState();
  const current = state.powerRound ?? {
    active: false,
    revealed: false,
    picks: [],
  };
  await AuctionStateStore.updateById(STATE_ID, {
    powerRound: { ...current, ...patch },
  });
  invalidateSnapshot();
}

/** Teams that have not yet won a power player, so still owe a pick. */
function teamsStillNeedingPower(
  snap: AuctionSnapshot,
  category: PlayerCategoryDoc
): TeamDoc[] {
  const won = new Set(
    snap.players
      .filter((p) => p.categoryId === category._id && p.status === "SOLD")
      .map((p) => p.soldToTeamId)
      .filter((id): id is string => Boolean(id))
  );
  return snap.teams.filter((team) => !won.has(team._id));
}

/**
 * Opens the round with a clean slate of picks.
 *
 * The lot on the block has to go back in the pool first, because this round
 * puts every power player on the board at once and a lot that is still live
 * would be both on the block and up for offers. A lot that has already drawn
 * bids is not unwound silently — that is a result the room has watched happen,
 * so the admin is asked to settle it.
 */
export async function startPowerRound() {
  const snap = await loadSnapshot();
  if (!powerCategoryOf(snap)) {
    throw new ServiceError("No power-player category is configured");
  }

  const state = snap.state;
  if (state.status === "LIVE" && state.currentPlayerId) {
    const live = snap.playersById.get(state.currentPlayerId);
    if ((state.bids ?? []).length > 0) {
      throw new ServiceError(
        `${live?.name ?? "The live lot"} already has bids — sell or mark them unsold before opening the power round`
      );
    }
    await claimPlayerStatus(state.currentPlayerId, ["LIVE"], {
      status: "PENDING",
      soldToTeamId: null,
      soldPrice: null,
    });
    await clearLiveAuctionState(state.currentPlayerId);
  }

  await writePowerRound({ active: true, revealed: false, picks: [] });
  invalidateSnapshot();
  return getFullState();
}

/** Closes the round. Picks are discarded; anything already won stays won. */
export async function endPowerRound() {
  await writePowerRound({ active: false, revealed: false, picks: [] });
  return getFullState();
}

/** Shows or hides every standing offer on the display board. */
export async function revealPowerPicks(revealed: boolean) {
  const snap = await loadSnapshot();
  if (!powerRoundOf(snap).active) {
    throw new ServiceError("The power-player round is not open");
  }
  await writePowerRound({ revealed });
  return getFullState();
}

/**
 * Records one team's offer, replacing any offer it had already made.
 *
 * The cap is the team's own remaining purse rather than the engine's bid
 * limit: this is the last round, so there are no later slots to hold money
 * back for.
 */
export async function setPowerPick(
  teamId: string,
  playerId: string,
  amount: number
) {
  assertId(teamId, "team id");
  assertId(playerId, "player id");
  assertMoney(amount, "Offer");

  const snap = await loadSnapshot();
  const round = powerRoundOf(snap);
  if (!round.active) throw new ServiceError("The power-player round is not open");

  const category = powerCategoryOf(snap);
  if (!category) throw new ServiceError("No power-player category is configured");

  const team = snap.teamsById.get(teamId);
  if (!team) throw new ServiceError("Team not found", 404);

  const player = snap.playersById.get(playerId);
  if (!player) throw new ServiceError("Player not found", 404);
  if (player.categoryId !== category._id) {
    throw new ServiceError(`${player.name} is not a power player`);
  }
  if (player.status === "SOLD") {
    throw new ServiceError(`${player.name} has already been won`);
  }

  if (!teamsStillNeedingPower(snap, category).some((t) => t._id === teamId)) {
    throw new ServiceError(`${team.name} already has a power player`);
  }

  const basePrice = basePriceOf(player, category);
  if (amount < basePrice) {
    throw new ServiceError(`Offer must be at least ${fmt(basePrice)}`);
  }

  const ledger = snap.ledgerByTeam.get(teamId);
  const remaining = ledger ? ledger.remaining : team.initialBudget;
  if (amount > remaining + 1e-9) {
    throw new ServiceError(`${team.name} has only ${fmt(remaining)} left`);
  }

  const picks = round.picks.filter((pick) => pick.teamId !== teamId);
  picks.push({ teamId, playerId, amount });
  await writePowerRound({ picks });

  return getFullState();
}

/** Withdraws a team's offer so it can choose again. */
export async function clearPowerPick(teamId: string) {
  assertId(teamId, "team id");
  const snap = await loadSnapshot();
  const round = powerRoundOf(snap);
  if (!round.active) throw new ServiceError("The power-player round is not open");

  await writePowerRound({
    picks: round.picks.filter((pick) => pick.teamId !== teamId),
  });
  return getFullState();
}

/**
 * Awards every contested player to its highest offer, then clears the slate.
 *
 * An exact tie is not resolved here: two teams offering the same amount is a
 * call for the room to make, so this reports it and writes nothing rather than
 * picking a winner by document order. Every contest is checked before any sale
 * is written, so a tie late in the list cannot leave the round half resolved.
 */
export async function resolvePowerRound() {
  const snap = await loadSnapshot();
  const round = powerRoundOf(snap);
  if (!round.active) throw new ServiceError("The power-player round is not open");
  if (!round.picks.length) throw new ServiceError("No team has chosen yet");

  const category = powerCategoryOf(snap);
  if (!category) throw new ServiceError("No power-player category is configured");

  const byPlayer = new Map<string, StoredPowerPick[]>();
  for (const pick of round.picks) {
    byPlayer.set(pick.playerId, [...(byPlayer.get(pick.playerId) ?? []), pick]);
  }

  const winners: StoredPowerPick[] = [];
  for (const [playerId, picks] of byPlayer) {
    const best = Math.max(...picks.map((p) => p.amount));
    const top = picks.filter((p) => p.amount === best);
    if (top.length > 1) {
      const player = snap.playersById.get(playerId);
      const names = top
        .map((p) => snap.teamsById.get(p.teamId)?.name ?? p.teamId)
        .join(" and ");
      throw new ServiceError(
        `${names} both offered ${fmt(best)} for ${player?.name ?? "that player"} — ask them to re-bid before resolving`
      );
    }
    winners.push(top[0]);
  }

  const awarded: { playerName: string; teamName: string; amount: number }[] = [];
  for (const win of winners) {
    const player = snap.playersById.get(win.playerId);
    const team = snap.teamsById.get(win.teamId);
    if (!player || !team) continue;

    const sold = await claimPlayerStatus(
      player._id,
      ["PENDING", "UNSOLD", "LIVE"],
      { status: "SOLD", soldToTeamId: win.teamId, soldPrice: win.amount }
    );
    if (!sold) continue;

    await recordTransaction({
      teamId: win.teamId,
      type: "DEBIT",
      amount: -win.amount,
      note: `Power player ${player.name}`,
      playerId: player._id,
    });

    awarded.push({
      playerName: player.name,
      teamName: team.name,
      amount: win.amount,
    });
  }

  // Everyone who lost a contest starts again with an empty slate.
  await writePowerRound({ revealed: false, picks: [] });

  invalidateSnapshot();
  return { state: await getFullState(), awarded };
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
  // $size pins the ledger to the length the limit was checked against, so a
  // bid that raced another one is refused rather than silently accepted.
  const appended = await AuctionStateStore.findOneAndUpdate(
    {
      _id: STATE_ID,
      status: "LIVE",
      currentPlayerId: player._id,
      bids: { $size: bids.length },
    },
    { $push: { bids: { teamId, amount, at: new Date() } } }
  );

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

  await AuctionStateStore.findOneAndUpdate(
    {
      _id: STATE_ID,
      status: "LIVE",
      currentPlayerId: state.currentPlayerId,
      "bids.0": { $exists: true },
    } as never,
    { $pop: { bids: 1 } }
  );

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

/** Exactly what the board endpoint returns, so scoping cannot drift from it. */
type BoardState = Awaited<ReturnType<typeof getFullState>>;

/**
 * Removes the wallet figures a viewer is not entitled to.
 *
 * The admin runs the board and needs every purse to judge a bid. A franchise
 * sees its own and no one else's. The auctioneer holds no team, so sees none.
 *
 * This runs on the server rather than in the components because the board's
 * state is a JSON response: hiding a rival's purse only in the markup would
 * still hand it to anyone who opens the network tab, which in a room full of
 * captains with laptops is no protection at all.
 */
export function scopeWalletsForViewer(
  state: BoardState,
  viewer: { role: "admin" | "auctioneer" | "team"; teamId?: string | null }
): BoardState {
  if (viewer.role === "admin") return state;

  return {
    ...state,
    teams: state.teams.map((team) => {
      if (viewer.role === "team" && viewer.teamId && team._id === viewer.teamId) {
        return team;
      }
      // Squad counts stay: who holds how many players is public in the room.
      // `board` carries the spend limit and the locked money, so it goes too.
      const scoped = { ...team, spent: 0, remaining: 0 };
      if ("board" in scoped) delete (scoped as { board?: unknown }).board;
      return scoped;
    }),
  };
}
