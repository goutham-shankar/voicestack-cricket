import { collection, type Doc } from "@/lib/db";

export const AUCTION_STATUSES = ["IDLE", "LIVE"] as const;

export type AuctionStatus = (typeof AUCTION_STATUSES)[number];

/** One bid on the current lot. Replaced wholesale when a lot opens or closes. */
export type StoredBid = {
  teamId: string;
  amount: number;
  at: Date;
};

/** The last settled lot, kept so the board can show its SOLD/UNSOLD stamp. */
export type StoredLastResult = {
  playerId: string;
  kind: "SOLD" | "UNSOLD";
  teamId: string | null;
  amount: number | null;
  /** Changes per result, so the stamp animation replays exactly once. */
  key: string;
};

/**
 * One team's choice in the power-player round.
 *
 * The final round is not called lot by lot: every team picks one power player
 * and names what it will pay, all five at once, and the highest offer takes a
 * contested player. A pick is a standing offer until the round is resolved.
 */
export type StoredPowerPick = {
  teamId: string;
  playerId: string;
  amount: number;
};

export type StoredPowerRound = {
  active: boolean;
  /** Picks stay hidden on the display until the admin reveals them. */
  revealed: boolean;
  picks: StoredPowerPick[];
};

export type AuctionState = {
  status: AuctionStatus;
  currentPlayerId: string | null;
  /** Final-squads showcase on the display board, driven by the admin. */
  showcase: boolean;
  /** Categories whose round has been opened. The first round is always open. */
  openCategoryIds: string[];
  /** The round being auctioned now. */
  currentCategoryId: string | null;
  /** Bids on the current lot, oldest first. The last one is the standing bid. */
  bids: StoredBid[];
  /** Lot counter, shown on the board as "Lot N". */
  lotNo: number;
  lastResult: StoredLastResult | null;
  /** The final power-player round. Inactive for the rest of the auction. */
  powerRound: StoredPowerRound;
};

export type AuctionStateDoc = Doc<AuctionState>;

/** A single document, `auctionState/global` — read via `getAuctionState`. */
export const AuctionStateStore = collection<AuctionState>({
  name: "auctionState",
  defaults: () => ({
    status: "IDLE",
    currentPlayerId: null,
    showcase: false,
    openCategoryIds: [],
    currentCategoryId: null,
    bids: [],
    lotNo: 0,
    lastResult: null,
    powerRound: { active: false, revealed: false, picks: [] },
  }),
});
