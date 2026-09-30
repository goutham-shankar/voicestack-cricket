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

export type TeamSummary = {
  _id: string;
  name: string;
  logoUrl: string | null;
  initialBudget: number;
  maxSquadSize: number;
  spent: number;
  remaining: number;
  squadCount: number;
  slotsRemaining: number;
};

export type AuctionStateDTO = {
  status: "IDLE" | "LIVE";
  currentPlayerId: PlayerRef | null;
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
  highestSale: number;
};

export type AuctionRuntimeSettings = {
  timerSeconds: number;
  minReservePerSlot: number;
};

export type RecentSale = {
  _id: string;
  playerName: string;
  avatarUrl: string | null;
  price: number;
  teamName: string;
  teamLogoUrl: string | null;
  soldAt: string;
};

export type FullAuctionState = {
  auctionState: AuctionStateDTO;
  recentSales: RecentSale[];
  pendingPlayers: PlayerRef[];
  teams: TeamSummary[];
  settings: AuctionRuntimeSettings;
  stats: AuctionStats;
};

export type AuctionResult =
  | {
      status: "SOLD";
      playerName: string;
      playerAvatarUrl: string | null;
      teamName: string;
      price: number;
    }
  | { status: "UNSOLD"; playerName: string };
