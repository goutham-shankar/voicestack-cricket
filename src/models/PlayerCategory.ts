import { collection, type Doc } from "@/lib/firestore";

export type PlayerCategory = {
  name: string;
  defaultBasePrice: number;
  order: number;
  /** Mandatory slots each team must fill in this category. */
  minPerTeam: number;
  /** Most a team may hold in this category; null means unlimited. */
  maxPerTeam: number | null;
};

export type PlayerCategoryDoc = Doc<PlayerCategory>;

export const PlayerCategories = collection<PlayerCategory>({
  name: "playerCategories",
  unique: ["name"],
  defaults: () => ({
    name: "",
    defaultBasePrice: 0,
    order: 0,
    minPerTeam: 0,
    maxPerTeam: null,
  }),
});
