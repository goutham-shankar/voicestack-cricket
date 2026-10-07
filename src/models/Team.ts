import { collection, type Doc } from "@/lib/db";

export type Team = {
  name: string;
  logoUrl: string | null;
  initialBudget: number;
  /** Hard ceiling on squad size. null means no ceiling — the usual setup. */
  maxSquadSize: number | null;
  captainMale: string;
  captainFemale: string;
};

export type TeamDoc = Doc<Team>;

export const Teams = collection<Team>({
  name: "teams",
  unique: ["name"],
  defaults: () => ({
    name: "",
    logoUrl: null,
    initialBudget: 100000,
    maxSquadSize: null,
    captainMale: "",
    captainFemale: "",
  }),
});
