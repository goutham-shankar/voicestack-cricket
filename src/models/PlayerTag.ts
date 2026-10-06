import { collection, type Doc } from "@/lib/firestore";

export type PlayerTag = {
  name: string;
  color: string;
};

export type PlayerTagDoc = Doc<PlayerTag>;

export const PlayerTags = collection<PlayerTag>({
  name: "playerTags",
  unique: ["name"],
  defaults: () => ({ name: "", color: "#d4a017" }),
});
