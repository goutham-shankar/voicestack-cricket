import { collection, type Doc } from "@/lib/firestore";

export type AuctionSettings = {
  defaultWalletBudget: number;
  defaultMaxSquadSize: number;
  /** Smallest squad every team must end up with, captains included when they count. */
  minSquadSize: number;
  /** How much each bid must rise by. */
  bidIncrement: number;
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
    minSquadSize: 12,
    bidIncrement: 500,
    captainsCount: true,
  }),
});
