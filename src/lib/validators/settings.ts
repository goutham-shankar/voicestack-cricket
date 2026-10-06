import { z } from "zod";
import { moneySchema } from "@/lib/validators/money";

export const settingsSchema = z.object({
  defaultWalletBudget: moneySchema.min(0),
  defaultMaxSquadSize: z.number().int().min(1),
  /** Smallest squad every team must reach, captains included when they count. */
  minSquadSize: z.number().int().min(1, "Minimum squad must be at least 1").max(80),
  /** How much each bid must rise by. */
  bidIncrement: moneySchema.gt(0, "Bid increment must be more than 0"),
  /** Whether the two captains occupy mandatory squad slots. */
  captainsCount: z.boolean(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
