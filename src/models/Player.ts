import { collection, type Doc } from "@/lib/firestore";
import type { PLAYER_ROLES, PLAYER_STATUSES } from "@/lib/constants";

export type PlayerRole = (typeof PLAYER_ROLES)[number];
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

export type Player = {
  name: string;
  /**
   * Position in the roster as it was imported, so the app lists players in the
   * same order as the source sheet. A batch import stamps every row with the
   * same createdAt, so that field cannot carry this.
   */
  order: number;
  avatarUrl: string | null;
  role: PlayerRole;
  categoryId: string;
  basePriceOverride: number | null;
  tagIds: string[];
  info: string;
  status: PlayerStatus;
  soldToTeamId: string | null;
  soldPrice: number | null;
};

export type PlayerDoc = Doc<Player>;

export const Players = collection<Player>({
  name: "players",
  defaults: () => ({
    name: "",
    order: 0,
    avatarUrl: null,
    role: "Batsman",
    categoryId: "",
    basePriceOverride: null,
    tagIds: [],
    info: "",
    status: "PENDING",
    soldToTeamId: null,
    soldPrice: null,
  }),
});
