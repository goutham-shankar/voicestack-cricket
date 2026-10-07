import { z } from "zod";
import { moneySchema } from "@/lib/validators/money";

export const teamSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  logoUrl: z.string().trim().optional().nullable(),
  initialBudget: moneySchema.min(0, "Budget must be 0 or more"),
  // Blank means no ceiling: squads must reach the minimum, but nothing stops a
  // team signing a 26th or 30th player if its purse allows.
  maxSquadSize: z
    .number()
    .int()
    .min(1, "Squad size must be at least 1")
    .nullable()
    .optional(),
  captainMale: z.string().trim().max(60).optional(),
  captainFemale: z.string().trim().max(60).optional(),
  loginEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  loginPassword: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
});

export type TeamInput = z.infer<typeof teamSchema>;
