import { z } from "zod";

export const tagSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(30),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #d4a017"),
});

export type TagInput = z.infer<typeof tagSchema>;
