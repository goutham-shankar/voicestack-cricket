import { randomUUID } from "crypto";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ServiceError } from "@/lib/services/service-error";
import AuctionStateModel from "@/models/AuctionState";
import AuctionSettingsModel from "@/models/AuctionSettings";
import PlayerModel from "@/models/Player";
import TeamModel from "@/models/Team";
import BidModel from "@/models/Bid";
import "@/models/PlayerCategory";
import "@/models/PlayerTag";
import {
  getAllLedgerSummaries,
  getLedgerSummary,
  recordTransaction,
} from "@/lib/services/wallet-ledger";

type AuctionSettingsLean = {
  timerSeconds?: number;
  bidIncrement?: number;
  minReservePerSlot?: number;
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
  bidIncrement: number;
  minReservePerSlot: number;
}> {
  const settings = (await AuctionSettingsModel.findOne({
    singleton: "global",
  }).lean()) as AuctionSettingsLean | null;
  return {
    timerSeconds: settings?.timerSeconds ?? 30,
    bidIncrement: settings?.bidIncrement ?? 500,
    minReservePerSlot: settings?.minReservePerSlot ?? 1000,
  };
}

async function getAuctionStateDoc() {
  return AuctionStateModel.findOneAndUpdate(
    { singleton: "global" },
    { $setOnInsert: { singleton: "global" } },
    { upsert: true, returnDocument: "after" }
  );
}

function assertValidBidAmount(amount: number) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || !Number.isInteger(amount)) {
    throw new ServiceError("Bid amount must be a finite integer");
  }
  if (amount <= 0) {
    throw new ServiceError("Bid amount must be greater than zero");
  }
}

function timerStillOpen(auctionState: {
  timerEnabled: boolean;
  timerPaused: boolean;
  timerEndsAt: Date | null;
}) {
  if (!auctionState.timerEnabled) return true;
  if (auctionState.timerPaused) return false;
  if (!auctionState.timerEndsAt) return true;
  return auctionState.timerEndsAt.getTime() > Date.now();
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

export async function getAllTeamsSummary(options?: {
  leadingTeamId?: string | null;
  currentBid?: number;
}) {
  const [teams, squadAggregates, ledgerByTeam] = await Promise.all([
    TeamModel.find().sort({ name: 1 }).lean(),
    PlayerModel.aggregate([
      { $match: { status: "SOLD", soldToTeamId: { $ne: null } } },
      { $group: { _id: "$soldToTeamId", squadCount: { $sum: 1 } } },
    ]),
    getAllLedgerSummaries(),
  ]);

  const squadByTeam = new Map(squadAggregates.map((a) => [String(a._id), a]));
  const leadingTeamId = options?.leadingTeamId ?? null;
  const currentBid = options?.currentBid ?? 0;

  return teams.map((team) => {
    const squadCount = squadByTeam.get(String(team._id))?.squadCount ?? 0;
    const ledger = ledgerByTeam.get(String(team._id));
    const spent = ledger?.spent ?? 0;
    const remaining = ledger?.remaining ?? team.initialBudget;
    const committed =
      leadingTeamId && String(team._id) === leadingTeamId ? currentBid : 0;
    return {
      _id: String(team._id),
      name: team.name,
      logoUrl: team.logoUrl,
      initialBudget: team.initialBudget,
      maxSquadSize: team.maxSquadSize,
      spent,
      remaining,
      available: remaining - committed,
      squadCount,
      slotsRemaining: team.maxSquadSize - squadCount,
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

async function assertTeamCanAfford(
  team: { name: string; initialBudget: number; maxSquadSize: number },
  teamId: string,
  amount: number
) {
  const { spent, squadCount } = await getTeamFinancials(teamId);
  if (squadCount >= team.maxSquadSize) {
    throw new ServiceError(`${team.name} has a full squad`);
  }

  const { minReservePerSlot } = await getSettings();
  const slotsAfterPurchase = team.maxSquadSize - squadCount - 1;
  const reserve = Math.max(0, slotsAfterPurchase) * minReservePerSlot;

  if (spent + amount + reserve > team.initialBudget) {
    throw new ServiceError(
      `${team.name} does not have enough wallet balance` +
        (reserve > 0
          ? ` (must keep ₹${reserve.toLocaleString("en-IN")} for remaining slots)`
          : "")
    );
  }

  return { spent, squadCount };
}

async function repairOrphanLivePlayers(currentPlayerId: Types.ObjectId | null) {
  const filter = currentPlayerId
    ? { status: "LIVE" as const, _id: { $ne: currentPlayerId } }
    : { status: "LIVE" as const };
  await PlayerModel.updateMany(filter, {
    $set: { status: "PENDING" },
  });
}

async function clearLiveAuctionState(
  expectedPlayerId: Types.ObjectId | string | null
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
        currentBid: 0,
        currentBidTeamId: null,
        bidCount: 0,
        lotKey: null,
        timerEndsAt: null,
        timerRemainingMs: null,
        timerPaused: false,
      },
    },
    { returnDocument: "after" }
  );
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

  await auctionState.populate([
    { path: "currentPlayerId", populate: ["categoryId", "tagIds"] },
    { path: "currentBidTeamId" },
  ]);

  const bidHistory =
    auctionState.currentPlayerId && auctionState.lotKey
      ? await BidModel.find({
          playerId: auctionState.currentPlayerId._id,
          lotKey: auctionState.lotKey,
        })
          .sort({ createdAt: -1 })
          .populate("teamId")
          .lean()
      : auctionState.currentPlayerId
        ? await BidModel.find({ playerId: auctionState.currentPlayerId._id })
            .sort({ createdAt: -1 })
            .populate("teamId")
            .lean()
        : [];

  const [totalPlayers, soldCount, unsoldCount, pendingCount, reauctionable, soldAgg, settings] =
    await Promise.all([
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
            highestBid: { $max: "$soldPrice" },
          },
        },
      ]),
      getSettings(),
    ]);

  const leadingTeamId = auctionState.currentBidTeamId
    ? String(
        typeof auctionState.currentBidTeamId === "object" &&
          auctionState.currentBidTeamId &&
          "_id" in auctionState.currentBidTeamId
          ? (auctionState.currentBidTeamId as { _id: Types.ObjectId })._id
          : auctionState.currentBidTeamId
      )
    : null;

  const teams = await getAllTeamsSummary({
    leadingTeamId,
    currentBid: auctionState.status === "LIVE" ? auctionState.currentBid : 0,
  });

  return {
    auctionState,
    bidHistory,
    pendingPlayers: await PlayerModel.find({ status: { $in: ["PENDING", "UNSOLD"] } })
      .populate("categoryId")
      .populate("tagIds")
      .sort({ createdAt: 1 })
      .lean(),
    teams,
    settings: {
      timerSeconds: settings.timerSeconds,
      bidIncrement: settings.bidIncrement,
      minReservePerSlot: settings.minReservePerSlot,
    },
    stats: {
      totalPlayers,
      sold: soldCount,
      unsold: unsoldCount,
      remaining: reauctionable,
      pending: pendingCount,
      totalSpent: soldAgg[0]?.totalSpent ?? 0,
      highestBid: Math.max(
        soldAgg[0]?.highestBid ?? 0,
        auctionState.status === "LIVE" ? auctionState.currentBid : 0
      ),
    },
  };
}

type BuiltAuctionState = Awaited<ReturnType<typeof buildFullState>>;

/**
 * If the live lot's timer has expired, auto-sell to the high bidder or mark unsold.
 * Safe to call from reads and writes; returns null when nothing changed.
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

  if (auctionState.currentBidTeamId) {
    return sellPlayer(String(auctionState.currentBidTeamId), { fromTimer: true });
  }
  return markUnsold({ fromTimer: true });
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

  const { timerSeconds } = await getSettings();
  const lotKey = randomUUID();

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
        currentBid: basePrice,
        currentBidTeamId: null,
        bidCount: 0,
        lotKey,
        timerPaused: false,
        timerRemainingMs: null,
        timerEndsAt: timerEnabled
          ? new Date(Date.now() + timerSeconds * 1000)
          : null,
      },
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

export async function placeBid(teamId: string, amount: number) {
  await connectDB();

  const resolved = await resolveExpiredLot();
  if (resolved) {
    throw new ServiceError("Bidding closed — the lot just ended");
  }

  assertValidBidAmount(amount);

  if (!Types.ObjectId.isValid(teamId)) {
    throw new ServiceError("Invalid team id", 400);
  }

  const auctionState = await getAuctionStateDoc();
  if (auctionState.status !== "LIVE" || !auctionState.currentPlayerId) {
    throw new ServiceError("No player is currently live");
  }
  if (auctionState.timerPaused) {
    throw new ServiceError("Bidding is paused");
  }
  if (!timerStillOpen(auctionState)) {
    const closed = await resolveExpiredLot();
    if (closed) throw new ServiceError("Bidding closed — the lot just ended");
    throw new ServiceError("Bidding time has expired");
  }

  const { bidIncrement, timerSeconds } = await getSettings();
  // Bids always raise above the current/base price by at least one increment.
  const minBid = auctionState.currentBid + bidIncrement;

  if (amount < minBid) {
    throw new ServiceError(
      `Bid must be at least ₹${minBid.toLocaleString("en-IN")} (current ₹${auctionState.currentBid.toLocaleString("en-IN")} + ₹${bidIncrement.toLocaleString("en-IN")})`
    );
  }
  if ((amount - auctionState.currentBid) % bidIncrement !== 0) {
    throw new ServiceError(
      `Bid must increase in steps of ₹${bidIncrement.toLocaleString("en-IN")}`
    );
  }

  if (
    auctionState.currentBidTeamId &&
    String(auctionState.currentBidTeamId) === teamId
  ) {
    throw new ServiceError("Your team is already the highest bidder");
  }

  const team = await TeamModel.findById(teamId).lean();
  if (!team) throw new ServiceError("Team not found", 404);

  await assertTeamCanAfford(team, teamId, amount);

  const lotKey = auctionState.lotKey ?? randomUUID();
  if (!auctionState.lotKey) {
    auctionState.lotKey = lotKey;
    await auctionState.save();
  }

  const bid = await BidModel.create({
    playerId: auctionState.currentPlayerId,
    teamId,
    amount,
    lotKey,
  });

  const timerEndsAt = auctionState.timerEnabled
    ? new Date(Date.now() + timerSeconds * 1000)
    : null;

  // Opening bid may equal base price; raises must be strictly higher.
  const bidFilter: Record<string, unknown> = {
    singleton: "global",
    status: "LIVE",
    currentPlayerId: auctionState.currentPlayerId,
    lotKey,
    timerPaused: false,
    currentBidTeamId: auctionState.currentBidTeamId,
    currentBid: { $lt: amount },
    $or: [
      { timerEnabled: false },
      { timerEndsAt: null },
      { timerEndsAt: { $gt: new Date() } },
    ],
  };

  const updated = await AuctionStateModel.findOneAndUpdate(
    bidFilter,
    {
      $set: {
        currentBid: amount,
        currentBidTeamId: new Types.ObjectId(teamId),
        timerEndsAt,
        timerPaused: false,
        timerRemainingMs: null,
      },
      $inc: { bidCount: 1 },
    },
    { returnDocument: "after" }
  );

  if (!updated) {
    await BidModel.deleteOne({ _id: bid._id });
    throw new ServiceError("Bid rejected — auction state changed, try again");
  }

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

export async function resetBid() {
  await connectDB();
  const auctionState = await getAuctionStateDoc();
  if (auctionState.status !== "LIVE" || !auctionState.currentPlayerId) {
    throw new ServiceError("No auction is live");
  }

  const player = await PlayerModel.findById(auctionState.currentPlayerId).populate(
    "categoryId"
  );
  if (!player) throw new ServiceError("Player not found", 404);

  const basePrice = await basePriceFor(player);
  const { timerSeconds } = await getSettings();
  const lotKey = randomUUID();

  // Keep prior bids for history; new lotKey scopes the live bid list.
  auctionState.currentBid = basePrice;
  auctionState.currentBidTeamId = null;
  auctionState.bidCount = 0;
  auctionState.lotKey = lotKey;
  auctionState.timerPaused = false;
  auctionState.timerRemainingMs = null;
  auctionState.timerEndsAt = auctionState.timerEnabled
    ? new Date(Date.now() + timerSeconds * 1000)
    : null;
  await auctionState.save();

  return getFullState({ resolveExpired: false });
}

export async function sellPlayer(
  teamId: string,
  options?: { allowOverride?: boolean; fromTimer?: boolean }
) {
  await connectDB();

  if (!Types.ObjectId.isValid(teamId)) {
    throw new ServiceError("Invalid team id", 400);
  }

  const auctionState = await getAuctionStateDoc();
  if (auctionState.status !== "LIVE" || !auctionState.currentPlayerId) {
    throw new ServiceError("No player is currently live");
  }

  const leadingId = auctionState.currentBidTeamId
    ? String(auctionState.currentBidTeamId)
    : null;

  if (!leadingId) {
    throw new ServiceError("No bids to sell on — mark unsold instead");
  }

  if (teamId !== leadingId && !options?.allowOverride) {
    throw new ServiceError("Player can only be sold to the current highest bidder");
  }

  const player = await PlayerModel.findById(auctionState.currentPlayerId);
  if (!player) throw new ServiceError("Player not found", 404);
  if (player.status === "SOLD") throw new ServiceError("Player already sold");

  const team = await TeamModel.findById(teamId).lean();
  if (!team) throw new ServiceError("Team not found", 404);

  const price = auctionState.currentBid;
  await assertTeamCanAfford(team, teamId, price);

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

  const cleared = await clearLiveAuctionState(player._id);
  if (!cleared && !options?.fromTimer) {
    // Player already sold; force idle if still pointing at this player
    await AuctionStateModel.findOneAndUpdate(
      { singleton: "global", currentPlayerId: player._id },
      {
        $set: {
          status: "IDLE",
          currentPlayerId: null,
          currentBid: 0,
          currentBidTeamId: null,
          bidCount: 0,
          lotKey: null,
          timerEndsAt: null,
          timerRemainingMs: null,
          timerPaused: false,
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
      teamName: team.name,
      price,
    },
  };
}

export async function markUnsold(options?: { fromTimer?: boolean; force?: boolean }) {
  await connectDB();
  const auctionState = await getAuctionStateDoc();
  if (auctionState.status !== "LIVE" || !auctionState.currentPlayerId) {
    throw new ServiceError("No player is currently live");
  }

  if (auctionState.currentBidTeamId && !options?.force && !options?.fromTimer) {
    throw new ServiceError(
      "There is an active high bid — confirm force unsold or sell to the leading team"
    );
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

  await clearLiveAuctionState(player._id);

  const state = await getFullState({ resolveExpired: false });
  return {
    state,
    result: { status: "UNSOLD" as const, playerName: player.name },
  };
}
