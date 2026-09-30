import { z } from "zod";

export const settingsSchema = z.object({
  defaultWalletBudget: z.number().int().min(0),
  defaultMaxSquadSize: z.number().int().min(1),
  timerSeconds: z.number().int().min(5).max(300),
  minReservePerSlot: z.number().int().min(0),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
