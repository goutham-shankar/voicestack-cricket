import { collection, type Doc } from "@/lib/firestore";

export type Team = {
  name: string;
  logoUrl: string | null;
  initialBudget: number;
  maxSquadSize: number;
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
    maxSquadSize: 12,
    captainMale: "",
    captainFemale: "",
  }),
});
