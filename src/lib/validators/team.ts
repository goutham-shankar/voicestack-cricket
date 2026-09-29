import { z } from "zod";

export const teamSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  logoUrl: z.string().trim().optional().nullable(),
  initialBudget: z.number().int().min(0, "Budget must be 0 or more"),
  maxSquadSize: z.number().int().min(1, "Squad size must be at least 1"),
  loginEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  loginPassword: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
});

export type TeamInput = z.infer<typeof teamSchema>;
