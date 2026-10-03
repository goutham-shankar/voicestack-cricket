import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ServiceError } from "@/lib/services/service-error";
import AuctionStateModel from "@/models/AuctionState";
import AuctionSettingsModel from "@/models/AuctionSettings";
import PlayerModel from "@/models/Player";
import TeamModel from "@/models/Team";
import PlayerCategoryModel from "@/models/PlayerCategory";
import "@/models/PlayerTag";
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

type AuctionSettingsLean = {
  timerSeconds?: number;
  minSquadSize?: number;
  bidIncrement?: number;
  captainsCount?: boolean;
};

type ResolveResult =
  | {
      status: "SOLD";
      playerName: string;
      teamName: string;
      price: number;
    }
  | {
      status: "UNSOLD";
      playerName: string;
    };

async function getSettings(): Promise<{
  timerSeconds: number;
  minSquadSize: number;
  bidIncrement: number;
  captainsCount: boolean;
}> {
  const settings = (await AuctionSettingsModel.findOne({
    singleton: "global",
  }).lean()) as AuctionSettingsLean | null;
  return {
    timerSeconds: settings?.timerSeconds ?? 30,
    minSquadSize: settings?.minSquadSize ?? 12,
    bidIncrement: settings?.bidIncrement ?? 500,
    captainsCount: settings?.captainsCount ?? true,
  };
}

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
async function buildEngineContext(auctionState: {
  openCategoryIds?: unknown;
  currentCategoryId?: unknown;
}): Promise<EngineContext> {
  const [categoryDocs, teamDocs, playerDocs, settings, ledgerByTeam] =
    await Promise.all([
      PlayerCategoryModel.find().sort({ order: 1, name: 1 }).lean(),
      TeamModel.find().sort({ name: 1 }).lean(),
      PlayerModel.find({}, "name categoryId status soldToTeamId soldPrice").lean(),
      getSettings(),
      getAllLedgerSummaries(),
    ]);

  const categories: EngineCategory[] = categoryDocs.map((c) => ({
    id: String(c._id),
    name: c.name,
    order: c.order ?? 0,
    basePrice: c.defaultBasePrice ?? 0,
    minPerTeam: c.minPerTeam ?? 0,
    maxPerTeam: c.maxPerTeam ?? null,
  }));

  const teams: EngineTeam[] = teamDocs.map((team) => {
    const ledger = ledgerByTeam.get(String(team._id));
    const spent = ledger?.spent ?? 0;
    const remaining = ledger?.remaining ?? team.initialBudget;
    return {
      id: String(team._id),
      name: team.name,
      budget: r2(spent + remaining),
      spent,
      maxSquadSize: team.maxSquadSize ?? null,
    };
  });

  const players: EnginePlayer[] = playerDocs.map((pl) => ({
    id: String(pl._id),
    name: pl.name,
    categoryId: String(pl.categoryId),
    status: pl.status as EnginePlayer["status"],
    teamId: pl.soldToTeamId ? String(pl.soldToTeamId) : null,
    price: pl.soldPrice ?? null,
  }));

  const openIds = Array.isArray(auctionState.openCategoryIds)
    ? auctionState.openCategoryIds.map((id) => String(id))
    : [];
  // Tolerate stale ids the way the board's normalize() does.
  const known = new Set(categories.map((c) => c.id));
  const currentRaw = auctionState.currentCategoryId
    ? String(auctionState.currentCategoryId)
    : null;

  const input: EngineInput = {
    categories,
    teams,
    players,
    settings: {
      minSquadSize: settings.minSquadSize,
      bidIncrement: settings.bidIncrement,
      captainsCount: settings.captainsCount,
    },
    openCategoryIds: openIds.filter((id) => known.has(id)),
    currentCategoryId:
      currentRaw && known.has(currentRaw)
        ? currentRaw
        : (categories[0]?.id ?? null),
  };

  return { input, stats: allTeamStats(input), categories };
}

async function getAuctionStateDoc() {
  return AuctionStateModel.findOneAndUpdate(
    { singleton: "global" },
    { $setOnInsert: { singleton: "global" } },
    { upsert: true, returnDocument: "after" }
  );
}

export async function getTeamFinancials(teamId: string) {
  const [squadCount, ledger] = await Promise.all([
    PlayerModel.countDocuments({
      soldToTeamId: new Types.ObjectId(teamId),
      status: "SOLD",
    }),
    getLedgerSummary(teamId),
  ]);
  return { spent: ledger.spent, squadCount };
}

export async function getAllTeamsSummary() {
  const [teams, squadAggregates, ledgerByTeam] = await Promise.all([
    TeamModel.find().sort({ name: 1 }).lean(),
    PlayerModel.aggregate([
      { $match: { status: "SOLD", soldToTeamId: { $ne: null } } },
      { $group: { _id: "$soldToTeamId", squadCount: { $sum: 1 } } },
    ]),
    getAllLedgerSummaries(),
  ]);

  const squadByTeam = new Map(squadAggregates.map((a) => [String(a._id), a]));

  return teams.map((team) => {
    const squadCount = squadByTeam.get(String(team._id))?.squadCount ?? 0;
    const ledger = ledgerByTeam.get(String(team._id));
    const spent = ledger?.spent ?? 0;
    const remaining = ledger?.remaining ?? team.initialBudget;
    return {
      _id: String(team._id),
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

async function basePriceFor(player: {
  basePriceOverride?: number | null;
  categoryId: unknown;
}) {
  if (player.basePriceOverride != null) return player.basePriceOverride;
  const category = player.categoryId as { defaultBasePrice?: number } | null;
  return category?.defaultBasePrice ?? 0;
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

async function repairOrphanLivePlayers(currentPlayerId: Types.ObjectId | null) {
  const filter = currentPlayerId
    ? { status: "LIVE" as const, _id: { $ne: currentPlayerId } }
    : { status: "LIVE" as const };
  await PlayerModel.updateMany(filter, {
    $set: { status: "PENDING" },
  });
}

type LastResultWrite = {
  playerId: Types.ObjectId;
  kind: "SOLD" | "UNSOLD";
  teamId: Types.ObjectId | null;
  amount: number | null;
  key: string;
};

/** A fresh key each time, so the board replays the stamp exactly once. */
function resultKey(kind: "SOLD" | "UNSOLD", playerId: Types.ObjectId | string) {
  return `${kind === "SOLD" ? "s" : "u"}-${String(playerId)}-${Date.now()}`;
}

async function clearLiveAuctionState(
  expectedPlayerId: Types.ObjectId | string | null,
  lastResult?: LastResultWrite
) {
  const filter: Record<string, unknown> = {
    singleton: "global",
    status: "LIVE",
  };
  if (expectedPlayerId) {
    filter.currentPlayerId = expectedPlayerId;
  }

  return AuctionStateModel.findOneAndUpdate(
    filter,
    {
      $set: {
        status: "IDLE",
        currentPlayerId: null,
        timerEndsAt: null,
        timerRemainingMs: null,
        timerPaused: false,
        bids: [],
        ...(lastResult ? { lastResult } : {}),
      },
    },
    { returnDocument: "after" }
  );
}

/**
 * Turns the stored state into the board's DTO: names on the last result, and
 * the open rounds normalised so the first round always reads as open.
 */
type StoredLastResult = {
  playerId: Types.ObjectId;
  kind: "SOLD" | "UNSOLD";
  teamId?: Types.ObjectId | null;
  amount?: number | null;
  key: string;
};

type StoredAuctionState = {
  status: "IDLE" | "LIVE";
  currentPlayerId: unknown;
  timerEnabled?: boolean;
  timerEndsAt?: Date | null;
  timerRemainingMs?: number | null;
  timerPaused?: boolean;
  showcase?: boolean;
  bids?: { teamId: Types.ObjectId; amount: number; at?: Date }[];
  lotNo?: number;
  lastResult?: StoredLastResult | null;
};

async function decorateStateForBoard(
  auctionState: { toObject?: () => unknown } & Record<string, unknown>,
  ctx: EngineContext
) {
  const raw = (
    typeof auctionState.toObject === "function"
      ? auctionState.toObject()
      : auctionState
  ) as StoredAuctionState;

  const stored = raw.lastResult;

  let lastResult = null;
  if (stored?.playerId) {
    const [player, team] = await Promise.all([
      PlayerModel.findById(stored.playerId, "name").lean(),
      stored.teamId ? TeamModel.findById(stored.teamId, "name").lean() : null,
    ]);
    if (player) {
      lastResult = {
        playerId: String(stored.playerId),
        playerName: player.name,
        kind: stored.kind,
        teamId: stored.teamId ? String(stored.teamId) : null,
        teamName: team?.name ?? null,
        amount: stored.amount ?? null,
        key: stored.key,
      };
    }
  }

  // The engine treats the first round as always open; say so explicitly here.
  const open = new Set(ctx.input.openCategoryIds);
  if (ctx.categories.length) open.add(ctx.categories[0].id);

  const bids = raw.bids ?? [];

  return {
    status: raw.status,
    currentPlayerId: raw.currentPlayerId,
    timerEnabled: raw.timerEnabled ?? true,
    timerEndsAt: raw.timerEndsAt ?? null,
    timerRemainingMs: raw.timerRemainingMs ?? null,
    timerPaused: raw.timerPaused ?? false,
    showcase: raw.showcase ?? false,
    openCategoryIds: ctx.categories.filter((c) => open.has(c.id)).map((c) => c.id),
    currentCategoryId: ctx.input.currentCategoryId,
    bids: bids.map((bid) => ({
      teamId: String(bid.teamId),
      amount: bid.amount,
      at: bid.at ?? null,
    })),
    lotNo: raw.lotNo ?? 0,
    lastResult,
  };
}

async function getRecentSales(limit = 8) {
  const sold = await PlayerModel.find({ status: "SOLD" })
    .populate("soldToTeamId")
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return sold.map((player) => {
    const team = player.soldToTeamId as unknown as
      | { _id: Types.ObjectId; name: string; logoUrl: string | null }
      | null;
    return {
      _id: String(player._id),
      playerName: player.name,
      avatarUrl: player.avatarUrl,
      price: player.soldPrice ?? 0,
      teamName: team?.name ?? "Unknown team",
      teamLogoUrl: team?.logoUrl ?? null,
      soldAt: (player as unknown as { updatedAt: Date }).updatedAt,
    };
  });
}

async function buildFullState() {
  const auctionState = await getAuctionStateDoc();

  if (auctionState.status === "IDLE") {
    await repairOrphanLivePlayers(null);
  } else if (auctionState.currentPlayerId) {
    await repairOrphanLivePlayers(auctionState.currentPlayerId);
    const livePlayer = await PlayerModel.findById(auctionState.currentPlayerId).lean();
    if (!livePlayer || livePlayer.status === "SOLD" || livePlayer.status === "UNSOLD") {
      await clearLiveAuctionState(auctionState.currentPlayerId);
      return buildFullState();
    }
  }

  await auctionState.populate({
    path: "currentPlayerId",
    populate: ["categoryId", "tagIds"],
  });

  const [
    totalPlayers,
    soldCount,
    unsoldCount,
    pendingCount,
    reauctionable,
    soldAgg,
    settings,
    recentSales,
  ] = await Promise.all([
    PlayerModel.countDocuments(),
    PlayerModel.countDocuments({ status: "SOLD" }),
    PlayerModel.countDocuments({ status: "UNSOLD" }),
    PlayerModel.countDocuments({ status: "PENDING" }),
    PlayerModel.countDocuments({ status: { $in: ["PENDING", "UNSOLD"] } }),
    PlayerModel.aggregate([
      { $match: { status: "SOLD" } },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$soldPrice" },
          highestSale: { $max: "$soldPrice" },
        },
      },
    ]),
    getSettings(),
    getRecentSales(),
  ]);

  const [teamSummaries, ctx] = await Promise.all([
    getAllTeamsSummary(),
    buildEngineContext(auctionState),
  ]);

  const livePlayer = auctionState.currentPlayerId as unknown as {
    _id: Types.ObjectId;
    name: string;
    categoryId: { _id: Types.ObjectId; defaultBasePrice?: number } | null;
    basePriceOverride?: number | null;
  } | null;

  // The round in play is the live lot's own category, otherwise the open round.
  const roundCategoryId = livePlayer?.categoryId
    ? String(livePlayer.categoryId._id)
    : ctx.input.currentCategoryId;

  const teams = teamSummaries.map((team) => {
    const stats = ctx.stats.get(team._id);
    if (!stats || !ctx.categories.length) return team;
    const limit = roundCategoryId
      ? bidLimit(ctx.input, team._id, roundCategoryId, ctx.stats)
      : null;
    return {
      ...team,
      board: {
        left: stats.left,
        locked: stats.locked,
        lockedParts: stats.lockedParts,
        spendable: stats.spendable,
        squad: stats.squad,
        count: stats.count,
        mand: stats.mand,
        rem: stats.rem,
        shortfall: stats.shortfall,
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

  const lotBasePrice = livePlayer ? await basePriceFor(livePlayer) : null;
  const bids: Bid[] = (auctionState.bids ?? []).map(
    (bid: { teamId: unknown; amount: number }) => ({
      teamId: String(bid.teamId),
      amount: bid.amount,
    })
  );

  return {
    auctionState: await decorateStateForBoard(auctionState, ctx),
    recentSales,
    pendingPlayers: await PlayerModel.find({ status: { $in: ["PENDING", "UNSOLD"] } })
      .populate("categoryId")
      .populate("tagIds")
      .sort({ createdAt: 1 })
      .lean(),
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
    settings: {
      timerSeconds: settings.timerSeconds,
      minSquadSize: settings.minSquadSize,
      bidIncrement: settings.bidIncrement,
      captainsCount: settings.captainsCount,
    },
    stats: {
      totalPlayers,
      sold: soldCount,
      unsold: unsoldCount,
      remaining: reauctionable,
      pending: pendingCount,
      totalSpent: soldAgg[0]?.totalSpent ?? 0,
      highestSale: soldAgg[0]?.highestSale ?? 0,
    },
  };
}

type BuiltAuctionState = Awaited<ReturnType<typeof buildFullState>>;

/**
 * If the live lot's timer has expired without an offline sale being recorded
 * yet, auto-mark it unsold so the room never stalls. Safe to call from reads
 * and writes; returns null when nothing changed.
 */
export async function resolveExpiredLot(): Promise<{
  state: BuiltAuctionState;
  result: ResolveResult;
} | null> {
  await connectDB();
  const auctionState = await getAuctionStateDoc();

  if (auctionState.status !== "LIVE" || !auctionState.currentPlayerId) {
    return null;
  }
  if (!auctionState.timerEnabled || auctionState.timerPaused) {
    return null;
  }
  if (!auctionState.timerEndsAt || auctionState.timerEndsAt.getTime() > Date.now()) {
    return null;
  }

  return markUnsold();
}

export async function getFullState(options?: { resolveExpired?: boolean }) {
  await connectDB();

  if (options?.resolveExpired !== false) {
    const resolved = await resolveExpiredLot();
    if (resolved) return resolved.state;
  }

  return buildFullState();
}

export async function startAuction(playerId: string) {
  await connectDB();
  await resolveExpiredLot();
  await getAuctionStateDoc();

  if (!Types.ObjectId.isValid(playerId)) {
    throw new ServiceError("Invalid player id", 400);
  }

  const player = await PlayerModel.findById(playerId).populate("categoryId");
  if (!player) throw new ServiceError("Player not found", 404);
  if (player.status === "SOLD") {
    throw new ServiceError("This player has already been sold");
  }
  if (player.status === "LIVE") {
    throw new ServiceError("This player is already live");
  }

  const basePrice = await basePriceFor(player);
  if (basePrice <= 0) {
    throw new ServiceError("Player base price must be greater than zero");
  }

  // The board auctions one round at a time.
  const roundState = await AuctionStateModel.findOne({ singleton: "global" }).lean();
  const roundCtx = await buildEngineContext(roundState ?? {});
  if (roundCtx.categories.length && roundCtx.input.currentCategoryId) {
    const playerCategoryId = String(
      (player.categoryId as unknown as { _id: Types.ObjectId })._id
    );
    if (playerCategoryId !== roundCtx.input.currentCategoryId) {
      const round = roundCtx.categories.find(
        (c) => c.id === roundCtx.input.currentCategoryId
      );
      throw new ServiceError(
        `${player.name} is auctioned in a different round. The ${round?.name ?? "current"} round is in play.`
      );
    }
  }

  const { timerSeconds } = await getSettings();

  // Claim the player first so two starts cannot put different players LIVE.
  const claimedPlayer = await PlayerModel.findOneAndUpdate(
    { _id: player._id, status: { $in: ["PENDING", "UNSOLD"] } },
    { $set: { status: "LIVE" } },
    { returnDocument: "after" }
  );
  if (!claimedPlayer) {
    throw new ServiceError("Player is not available to auction");
  }

  const existing = await AuctionStateModel.findOne({ singleton: "global" }).lean();
  const timerEnabled = existing?.timerEnabled ?? true;

  const claimedState = await AuctionStateModel.findOneAndUpdate(
    { singleton: "global", status: "IDLE" },
    {
      $set: {
        status: "LIVE",
        currentPlayerId: player._id,
        timerPaused: false,
        timerRemainingMs: null,
        timerEndsAt: timerEnabled
          ? new Date(Date.now() + timerSeconds * 1000)
          : null,
        bids: [],
        lastResult: null,
      },
      $inc: { lotNo: 1 },
    },
    { returnDocument: "after" }
  );

  if (!claimedState) {
    await PlayerModel.findOneAndUpdate(
      { _id: player._id, status: "LIVE" },
      { $set: { status: player.status } }
    );
    throw new ServiceError("An auction is already in progress");
  }

  await repairOrphanLivePlayers(player._id);

  return getFullState({ resolveExpired: false });
}

export async function pauseTimer() {
  await connectDB();
  const auctionState = await getAuctionStateDoc();
  if (auctionState.status !== "LIVE") throw new ServiceError("No auction is live");
  if (!auctionState.timerEnabled) throw new ServiceError("Timer is disabled");
  if (auctionState.timerPaused) return getFullState({ resolveExpired: false });

  const remaining = auctionState.timerEndsAt
    ? auctionState.timerEndsAt.getTime() - Date.now()
    : 0;
  auctionState.timerRemainingMs = Math.max(remaining, 0);
  auctionState.timerEndsAt = null;
  auctionState.timerPaused = true;
  await auctionState.save();

  return getFullState({ resolveExpired: false });
}

export async function resumeTimer() {
  await connectDB();
  const auctionState = await getAuctionStateDoc();
  if (auctionState.status !== "LIVE") throw new ServiceError("No auction is live");
  if (!auctionState.timerPaused) return getFullState({ resolveExpired: false });

  const remaining = auctionState.timerRemainingMs ?? 0;
  if (remaining <= 0) {
    auctionState.timerPaused = false;
    auctionState.timerRemainingMs = null;
    auctionState.timerEndsAt = new Date(Date.now());
    await auctionState.save();
    const resolved = await resolveExpiredLot();
    if (resolved) return resolved.state;
  }

  auctionState.timerEndsAt = new Date(Date.now() + remaining);
  auctionState.timerRemainingMs = null;
  auctionState.timerPaused = false;
  await auctionState.save();

  return getFullState({ resolveExpired: false });
}

export async function setTimerEnabled(enabled: boolean) {
  await connectDB();
  const auctionState = await getAuctionStateDoc();
  auctionState.timerEnabled = enabled;

  if (!enabled) {
    auctionState.timerEndsAt = null;
    auctionState.timerRemainingMs = null;
    auctionState.timerPaused = false;
  } else if (auctionState.status === "LIVE" && !auctionState.timerPaused) {
    const { timerSeconds } = await getSettings();
    auctionState.timerEndsAt = new Date(Date.now() + timerSeconds * 1000);
  }

  await auctionState.save();
  return getFullState({ resolveExpired: false });
}

/** Restarts the pacing timer for the current lot — there is no bid to reset anymore. */
export async function resetTimer() {
  await connectDB();
  const auctionState = await getAuctionStateDoc();
  if (auctionState.status !== "LIVE" || !auctionState.currentPlayerId) {
    throw new ServiceError("No auction is live");
  }

  const { timerSeconds } = await getSettings();
  auctionState.timerPaused = false;
  auctionState.timerRemainingMs = null;
  auctionState.timerEndsAt = auctionState.timerEnabled
    ? new Date(Date.now() + timerSeconds * 1000)
    : null;
  await auctionState.save();

  return getFullState({ resolveExpired: false });
}

/**
 * Admin records the final result of an offline (verbal) auction round —
 * the winning team and the hammer price — and the player is marked sold.
 */
export async function sellPlayer(teamId: string, price: number) {
  await connectDB();

  if (!Types.ObjectId.isValid(teamId)) {
    throw new ServiceError("Invalid team id", 400);
  }
  assertMoney(price, "Sold price");

  const auctionState = await getAuctionStateDoc();
  if (auctionState.status !== "LIVE" || !auctionState.currentPlayerId) {
    throw new ServiceError("No player is currently live");
  }

  const player = await PlayerModel.findById(auctionState.currentPlayerId);
  if (!player) throw new ServiceError("Player not found", 404);
  if (player.status === "SOLD") throw new ServiceError("Player already sold");

  const team = await TeamModel.findById(teamId).lean();
  if (!team) throw new ServiceError("Team not found", 404);

  const ctx = await buildEngineContext(auctionState);
  assertTeamCanAfford(ctx, teamId, String(player.categoryId), price);

  const soldPlayer = await PlayerModel.findOneAndUpdate(
    {
      _id: player._id,
      status: { $in: ["LIVE", "PENDING", "UNSOLD"] },
    },
    {
      $set: {
        status: "SOLD",
        soldToTeamId: new Types.ObjectId(teamId),
        soldPrice: price,
      },
    },
    { returnDocument: "after" }
  );

  if (!soldPlayer) {
    throw new ServiceError("Could not sell player — status changed");
  }

  await recordTransaction({
    teamId,
    type: "DEBIT",
    amount: -price,
    note: `Purchased ${player.name}`,
    playerId: String(player._id),
  });

  const soldResult: LastResultWrite = {
    playerId: player._id,
    kind: "SOLD",
    teamId: new Types.ObjectId(teamId),
    amount: price,
    key: resultKey("SOLD", player._id),
  };

  const cleared = await clearLiveAuctionState(player._id, soldResult);
  if (!cleared) {
    // Player already sold; force idle if still pointing at this player
    await AuctionStateModel.findOneAndUpdate(
      { singleton: "global", currentPlayerId: player._id },
      {
        $set: {
          status: "IDLE",
          currentPlayerId: null,
          timerEndsAt: null,
          timerRemainingMs: null,
          timerPaused: false,
          bids: [],
          lastResult: soldResult,
        },
      }
    );
  }

  const state = await getFullState({ resolveExpired: false });
  return {
    state,
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
  await connectDB();
  const auctionState = await getAuctionStateDoc();
  if (auctionState.status !== "LIVE" || !auctionState.currentPlayerId) {
    throw new ServiceError("No player is currently live");
  }

  const player = await PlayerModel.findById(auctionState.currentPlayerId);
  if (!player) throw new ServiceError("Player not found", 404);

  const updatedPlayer = await PlayerModel.findOneAndUpdate(
    { _id: player._id, status: { $ne: "SOLD" } },
    { $set: { status: "UNSOLD", soldToTeamId: null, soldPrice: null } },
    { returnDocument: "after" }
  );

  if (!updatedPlayer) {
    throw new ServiceError("Could not mark player unsold");
  }

  await clearLiveAuctionState(player._id, {
    playerId: player._id,
    kind: "UNSOLD",
    teamId: null,
    amount: null,
    key: resultKey("UNSOLD", player._id),
  });

  const state = await getFullState({ resolveExpired: false });
  return {
    state,
    result: { status: "UNSOLD" as const, playerName: player.name },
  };
}

/** Turns the display board's final-squads showcase on or off. */
export async function setShowcase(enabled: boolean) {
  await connectDB();
  await AuctionStateModel.findOneAndUpdate(
    { singleton: "global" },
    { $set: { showcase: enabled } },
    { upsert: true }
  );
  return buildFullState();
}

// ---------------------------------------------------------------- the board

/** The standing bid on the current lot, or null when nobody has bid. */
function standingBid(auctionState: {
  bids?: { teamId: unknown; amount: number }[];
}): { teamId: string; amount: number } | null {
  const bids = auctionState.bids ?? [];
  if (!bids.length) return null;
  const last = bids[bids.length - 1];
  return { teamId: String(last.teamId), amount: last.amount };
}

async function requireLiveLot() {
  const auctionState = await getAuctionStateDoc();
  if (auctionState.status !== "LIVE" || !auctionState.currentPlayerId) {
    throw new ServiceError("No player is currently live");
  }
  const player = await PlayerModel.findById(auctionState.currentPlayerId).populate(
    "categoryId"
  );
  if (!player) throw new ServiceError("Player not found", 404);
  return { auctionState, player };
}

/**
 * Records a bid from a team on the current lot. Validated with the same
 * `checkBid` the board uses to decide which paddles are live, so the server
 * stays the authority.
 */
export async function placeBid(teamId: string, amount: number) {
  await connectDB();
  if (!Types.ObjectId.isValid(teamId)) {
    throw new ServiceError("Invalid team id", 400);
  }
  assertMoney(amount, "Bid amount");

  const { auctionState, player } = await requireLiveLot();
  const ctx = await buildEngineContext(auctionState);
  const bids: Bid[] = (auctionState.bids ?? []).map(
    (bid: { teamId: unknown; amount: number }) => ({
      teamId: String(bid.teamId),
      amount: bid.amount,
    })
  );

  const basePrice = await basePriceFor(player);
  const verdict = checkBid(
    ctx.input,
    bids,
    {
      playerId: String(player._id),
      categoryId: String(
        (player.categoryId as unknown as { _id: Types.ObjectId })._id
      ),
      basePrice,
    },
    teamId,
    amount,
    ctx.stats
  );
  if (!verdict.ok) throw new ServiceError(verdict.message);

  // Guard against two bids landing at once: the ledger must not have grown.
  const updated = await AuctionStateModel.findOneAndUpdate(
    {
      singleton: "global",
      status: "LIVE",
      currentPlayerId: player._id,
      [`bids.${bids.length}`]: { $exists: false },
    },
    { $push: { bids: { teamId: new Types.ObjectId(teamId), amount, at: new Date() } } },
    { returnDocument: "after" }
  );
  if (!updated) {
    throw new ServiceError("Another bid landed first — check the board and try again");
  }

  return getFullState({ resolveExpired: false });
}

/** Takes back the most recent bid. */
export async function undoLastBid() {
  await connectDB();
  const auctionState = await getAuctionStateDoc();
  if (auctionState.status !== "LIVE" || !auctionState.currentPlayerId) {
    throw new ServiceError("No player is currently live");
  }
  if (!(auctionState.bids ?? []).length) {
    throw new ServiceError("There is no bid to undo");
  }

  await AuctionStateModel.findOneAndUpdate(
    { singleton: "global", status: "LIVE", currentPlayerId: auctionState.currentPlayerId },
    { $pop: { bids: 1 } }
  );

  return getFullState({ resolveExpired: false });
}

/**
 * Sells the current lot to whoever holds the standing bid. The limit is checked
 * again at the hammer, because other sales may have moved the team's purse.
 */
export async function sellToLeadingBid() {
  await connectDB();
  const { auctionState } = await requireLiveLot();
  const leading = standingBid(auctionState);
  if (!leading) {
    throw new ServiceError("No bids yet. Wait for a bid or mark the player unsold.");
  }
  return sellPlayer(leading.teamId, leading.amount);
}

/**
 * Opens a round and makes it the one in play. Opening a round releases the
 * money every team had locked for it.
 */
export async function setRound(categoryId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(categoryId)) {
    throw new ServiceError("Invalid category id", 400);
  }

  const auctionState = await getAuctionStateDoc();
  if (auctionState.status === "LIVE") {
    throw new ServiceError(
      "Sell the current player or mark them unsold before switching rounds"
    );
  }

  const category = await PlayerCategoryModel.findById(categoryId).lean();
  if (!category) throw new ServiceError("Category not found", 404);

  await AuctionStateModel.findOneAndUpdate(
    { singleton: "global" },
    {
      $addToSet: { openCategoryIds: category._id },
      $set: { currentCategoryId: category._id, lastResult: null },
    },
    { upsert: true }
  );

  return getFullState({ resolveExpired: false });
}

/** Puts an unsold player back into the waiting pool. */
export async function requeuePlayer(playerId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(playerId)) {
    throw new ServiceError("Invalid player id", 400);
  }

  const updated = await PlayerModel.findOneAndUpdate(
    { _id: playerId, status: "UNSOLD" },
    { $set: { status: "PENDING", soldToTeamId: null, soldPrice: null } },
    { returnDocument: "after" }
  );
  if (!updated) {
    throw new ServiceError("That player is not in the unsold list");
  }

  return getFullState({ resolveExpired: false });
}
