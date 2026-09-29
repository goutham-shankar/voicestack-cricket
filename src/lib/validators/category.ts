import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(40),
  defaultBasePrice: z.number().int().min(0, "Base price must be 0 or more"),
  order: z.number().int(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
