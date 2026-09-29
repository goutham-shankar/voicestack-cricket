export type CategoryRef = {
  _id: string;
  name: string;
  defaultBasePrice: number;
  order: number;
};

export type TagRef = { _id: string; name: string; color: string };

export type TeamRef = {
  _id: string;
  name: string;
  logoUrl: string | null;
  initialBudget: number;
  maxSquadSize: number;
};

export type PlayerRef = {
  _id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  categoryId: CategoryRef;
  basePriceOverride: number | null;
  tagIds: TagRef[];
  info: string;
  status: "PENDING" | "LIVE" | "SOLD" | "UNSOLD";
  soldToTeamId: string | null;
  soldPrice: number | null;
};

export type BidRecord = {
  _id: string;
  playerId: string;
  teamId: TeamRef;
  amount: number;
  lotKey?: string | null;
  createdAt: string;
};

export type TeamSummary = {
  _id: string;
  name: string;
  logoUrl: string | null;
  initialBudget: number;
  maxSquadSize: number;
  spent: number;
  remaining: number;
  /** Remaining minus committed high bid when this team is leading. */
  available: number;
  squadCount: number;
  slotsRemaining: number;
};

export type AuctionStateDTO = {
  status: "IDLE" | "LIVE";
  currentPlayerId: PlayerRef | null;
  currentBid: number;
  currentBidTeamId: TeamRef | null;
  bidCount: number;
  lotKey?: string | null;
  timerEnabled: boolean;
  timerEndsAt: string | null;
  timerRemainingMs: number | null;
  timerPaused: boolean;
};

export type AuctionStats = {
  totalPlayers: number;
  sold: number;
  unsold: number;
  remaining: number;
  pending?: number;
  totalSpent: number;
  highestBid: number;
};

export type AuctionRuntimeSettings = {
  timerSeconds: number;
  bidIncrement: number;
  minReservePerSlot: number;
};

export type FullAuctionState = {
  auctionState: AuctionStateDTO;
  bidHistory: BidRecord[];
  pendingPlayers: PlayerRef[];
  teams: TeamSummary[];
  settings: AuctionRuntimeSettings;
  stats: AuctionStats;
};

export type AuctionResult =
  | { status: "SOLD"; playerName: string; teamName: string; price: number }
  | { status: "UNSOLD"; playerName: string };
