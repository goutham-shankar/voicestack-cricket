import { z } from "zod";

/**
 * An amount of money. The auction engine rounds to two decimals, so anything
 * finer would not survive a round trip — the board can run in whole rupees or
 * in fractional crores, but not in thousandths.
 */
export const moneySchema = z
  .number()
  .refine((n) => Number.isFinite(n), "Must be a number")
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
    "At most two decimal places"
  );
