import { z } from "zod";
import { moneySchema } from "@/lib/validators/money";

export const settingsSchema = z.object({
  defaultWalletBudget: moneySchema.min(0),
  /** Smallest squad every team must reach, captains included when they count. */
  minSquadSize: z.number().int().min(1, "Minimum squad must be at least 1").max(80),
  /** Female captain counts toward this when captains count toward the squad. */
  minFemalePlayers: z
    .number()
    .int()
    .min(0, "Minimum female players cannot be negative")
    .max(80),
  /** How much each bid must rise by. */
  bidIncrement: moneySchema.gt(0, "Bid increment must be more than 0"),
  /** Banded steps; when present these replace the flat increment above. */
  bidIncrementTiers: z
    .array(z.object({ from: moneySchema.min(0), increment: moneySchema.gt(0) }))
    .optional(),
  /** Whether the two captains occupy mandatory squad slots. */
  captainsCount: z.boolean(),
}).refine((value) => value.minFemalePlayers <= value.minSquadSize, {
  message: "Female minimum cannot exceed the minimum squad size",
  path: ["minFemalePlayers"],
});

export type SettingsInput = z.infer<typeof settingsSchema>;
