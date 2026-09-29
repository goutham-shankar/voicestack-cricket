import { z } from "zod";
import { STAFF_ROLES } from "@/lib/constants";

const staffUserBase = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(STAFF_ROLES),
  teamId: z.string().trim().optional().or(z.literal("")),
});

function requireAuctioneerTeam<T extends { role: string; teamId?: string }>(
  data: T
) {
  return data.role !== "auctioneer" || Boolean(data.teamId);
}

export const staffUserSchema = staffUserBase
  .extend({
    password: z.string().min(6, "Password must be at least 6 characters"),
  })
  .refine(requireAuctioneerTeam, {
    message: "Select the team this auctioneer represents",
    path: ["teamId"],
  });

/** Password is optional on edit — leave blank to keep the current one. */
export const staffUserUpdateSchema = staffUserBase
  .extend({
    password: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || v.length >= 6, {
        message: "Password must be at least 6 characters",
      }),
  })
  .refine(requireAuctioneerTeam, {
    message: "Select the team this auctioneer represents",
    path: ["teamId"],
  });

export type StaffUserInput = z.infer<typeof staffUserSchema>;
export type StaffUserUpdateInput = z.infer<typeof staffUserUpdateSchema>;
