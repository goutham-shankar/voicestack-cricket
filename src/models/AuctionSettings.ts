import { collection, type Doc } from "@/lib/db";
import type { BidIncrementTier } from "@/lib/auction-engine";

export type AuctionSettings = {
  defaultWalletBudget: number;
  defaultMaxSquadSize: number;
  /** Smallest squad every team must end up with, captains included when they count. */
  minSquadSize: number;
  /** Fallback step, used only when no tiers are configured. */
  bidIncrement: number;
  /** Banded steps: how much a bid must rise by, given what it rises from. */
  bidIncrementTiers: BidIncrementTier[];
  /** Whether the two captains occupy mandatory squad slots. */
  captainsCount: boolean;
};

export type AuctionSettingsDoc = Doc<AuctionSettings>;

/** A single document, `auctionSettings/global` — read via `getSingleton`. */
export const AuctionSettingsStore = collection<AuctionSettings>({
  name: "auctionSettings",
  defaults: () => ({
    defaultWalletBudget: 100000,
    defaultMaxSquadSize: 12,
    minSquadSize: 20,
    bidIncrement: 20 * 100000,
    bidIncrementTiers: [
      { from: 0, increment: 10 * 100000 },
      { from: 100 * 100000, increment: 50 * 100000 },
      { from: 400 * 100000, increment: 100 * 100000 },
    ],
    captainsCount: true,
  }),
});
