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
  }),
});
