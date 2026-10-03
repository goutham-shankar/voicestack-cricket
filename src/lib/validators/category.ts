import { z } from "zod";
import { moneySchema } from "@/lib/validators/money";

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(40),
  defaultBasePrice: moneySchema.min(0, "Base price must be 0 or more"),
  order: z.number().int(),
  /** Mandatory slots each team must fill in this category. */
  minPerTeam: z.number().int().min(0, "Minimum must be 0 or more"),
  /** Most a team may hold; blank means unlimited. */
  maxPerTeam: z
    .number()
    .int()
    .min(0, "Maximum must be 0 or more")
    .nullable()
    .optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
