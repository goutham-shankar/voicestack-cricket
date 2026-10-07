import { z } from "zod";
import { PLAYER_ROLES } from "@/lib/constants";

export const playerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  avatarUrl: z.string().trim().optional().nullable(),
  role: z.enum(PLAYER_ROLES),
  gender: z.enum(["M", "F"], "Gender is required"),
  categoryId: z.string().trim().min(1, "Category is required"),
  basePriceOverride: z.number().int().min(0).optional().nullable(),
  tagIds: z.array(z.string()),
  info: z.string().trim().max(1000),
});

export type PlayerInput = z.infer<typeof playerSchema>;
