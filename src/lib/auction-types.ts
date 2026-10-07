export type CategoryRef = {
  _id: string;
  name: string;
  defaultBasePrice: number;
  order: number;
  /** Mandatory slots each team must fill in this category. */
  minPerTeam: number;
  /** Most a team may hold; null means unlimited. */
  maxPerTeam: number | null;
};

export type TagRef = { _id: string; name: string; color: string };

export type TeamRef = {
  _id: string;
  name: string;
  logoUrl: string | null;
  initialBudget: number;
  /** null means no ceiling on squad size. */
  maxSquadSize: number | null;
  captainMale: string;
  captainFemale: string;
};

/**
 * Engine figures for one team, computed server-side so the board does not have
 * to recompute them. Mirrors `TeamStats` / `BidLimit` in `auction-engine.ts`.
 */
export type TeamBoardStats = {
  /** Purse still unspent. */
  left: number;
  /** Money reserved for rounds that have not opened. */
  locked: number;
  lockedParts: { categoryId: string; amount: number }[];
  /** left - locked. */
  spendable: number;
  /** Squad size, captains included when they count. */
  squad: number;
  /** Players bought per category id. */
  count: Record<string, number>;
  /** Mandatory slots per category id. */
  mand: Record<string, number>;
  /** Mandatory slots still unfilled per category id. */
  rem: Record<string, number>;
  /** Short of being able to finish the squad at base prices. */
  shortfall: number;
  /** Female players including the female captain when captains count. */
  female: number;
  /** Female players still needed to reach the configured minimum. */
  femaleRem: number;
  /** Additional reserve needed for female slots beyond category requirements. */
  femaleReserve: number;
  /** Max bid for the round in play, or why the team cannot bid. */
  limit:
    | { ok: true; max: number; holdAll: number; holdOpen: number; fills: boolean }
    | { ok: false; code: string; reason: string; max: number };
};

export type PlayerRef = {
  _id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  gender: "M" | "F" | null;
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
  /** null means no ceiling on squad size. */
  maxSquadSize: number | null;
  spent: number;
  remaining: number;
  squadCount: number;
  /** Female players held, including the female captain when captains count. */
  femaleCount: number;
  /** null whenever there is no ceiling to count down to. */
  slotsRemaining: number | null;
  captainMale: string;
  captainFemale: string;
  /** Present whenever categories are configured. */
  board?: TeamBoardStats;
};

export type BidEntryDTO = { teamId: string; amount: number; at: string };

export type LastResultDTO = {
  playerId: string;
  playerName: string;
  kind: "SOLD" | "UNSOLD";
  teamId: string | null;
  teamName: string | null;
  amount: number | null;
  /** Changes per result so the stamp animation replays exactly once. */
  key: string;
};

/** One team's standing offer for a power player, as the board reads it. */
export type PowerPickDTO = {
  teamId: string;
  teamName: string;
  teamLogoUrl: string | null;
  playerId: string;
  playerName: string;
  amount: number;
};

export type PowerRoundDTO = {
  active: boolean;
  /** Picks stay hidden on the display until the admin reveals them. */
  revealed: boolean;
  picks: PowerPickDTO[];
};

/** A power player as the final-round board shows them. */
export type PowerPlayerDTO = {
  _id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  basePrice: number;
  status: "PENDING" | "LIVE" | "SOLD" | "UNSOLD";
  /** Set once the player has been won. */
  wonByTeamId: string | null;
  wonByTeamName: string | null;
  soldPrice: number | null;
};

export type AuctionStateDTO = {
  status: "IDLE" | "LIVE";
  currentPlayerId: PlayerRef | null;
  showcase?: boolean;
  /** Bids on the current lot, oldest first; the last is the standing bid. */
  bids: BidEntryDTO[];
  /** Categories whose round has opened. The first round is always open. */
  openCategoryIds: string[];
  /** The round being auctioned now. */
  currentCategoryId: string | null;
  lotNo: number;
  lastResult: LastResultDTO | null;
  powerRound: PowerRoundDTO;
};

export type SquadPlayer = {
  _id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  category: string | null;
  price: number;
};

export type TeamSquad = {
  _id: string;
  name: string;
  logoUrl: string | null;
  spent: number;
  remaining: number;
  maxSquadSize: number | null;
  players: SquadPlayer[];
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
  /** Smallest squad every team must reach, captains included when they count. */
  minSquadSize: number;
  /** Female players required; the female captain counts when captains do. */
  minFemalePlayers: number;
  /** Fallback step, used only when no tiers are configured. */
  bidIncrement: number;
  /** Banded steps: how much a bid must rise by, given what it rises from. */
  bidIncrementTiers?: { from: number; increment: number }[];
  captainsCount: boolean;
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
  /** Rounds, in order. Empty until categories are configured. */
  categories: CategoryRef[];
  /** Smallest acceptable next bid on the current lot. */
  minNextBid: number | null;
  /** Base price of the current lot. */
  lotBasePrice: number | null;
  /** Every player in the power-player round, whatever their status. */
  powerPlayers: PowerPlayerDTO[];
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
