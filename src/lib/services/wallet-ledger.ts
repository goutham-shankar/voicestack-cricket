import { isDuplicateKeyError } from "@/lib/db-errors";
import { WalletTransactions, type WalletTransactionType } from "@/models/WalletTransaction";

/** Ledger order: by position, which is assigned on append and never reused. */
function byEntryOrder(a: { seq: number }, b: { seq: number }) {
  return a.seq - b.seq;
}

const MAX_APPEND_ATTEMPTS = 5;

/**
 * Appends one immutable ledger entry for a team and returns it.
 * `amount` is signed: positive credits the wallet, negative debits it.
 *
 * The running balance is derived from the entry before it, so two concurrent
 * purchases must not both build on the same predecessor. Rather than hold a
 * transaction open across the read and the write — which would oblige every
 * deployment to run a replica set — the entry claims the next position in the
 * team's ledger, and the unique index on (teamId, seq) rejects the loser of a
 * race. It then retries, reading the balance the winner actually wrote.
 */
export async function recordTransaction({
  teamId,
  type,
  amount,
  note,
  playerId,
}: {
  teamId: string;
  type: WalletTransactionType;
  amount: number;
  note: string;
  playerId?: string | null;
}) {
  for (let attempt = 1; attempt <= MAX_APPEND_ATTEMPTS; attempt++) {
    const entries = await WalletTransactions.find({ teamId });
    const last = entries.sort(byEntryOrder).at(-1);

    try {
      return await WalletTransactions.create({
        teamId,
        type,
        amount,
        balanceAfter: (last?.balanceAfter ?? 0) + amount,
        playerId: playerId ?? null,
        note,
        seq: (last?.seq ?? 0) + 1,
      });
    } catch (error) {
      // Another entry took this position; re-read and build on it instead.
      if (isDuplicateKeyError(error) && attempt < MAX_APPEND_ATTEMPTS) continue;
      throw error;
    }
  }

  throw new Error(
    `Could not append to ${teamId}'s ledger after ${MAX_APPEND_ATTEMPTS} attempts`
  );
}

/** Bulk version of getLedgerSummary: one read, grouped by team. */
export async function getAllLedgerSummaries() {
  const entries = await WalletTransactions.find();
  const summaries = new Map<string, { remaining: number; spent: number }>();

  for (const entry of entries) {
    const summary = summaries.get(entry.teamId) ?? { remaining: 0, spent: 0 };
    summary.remaining += entry.amount;
    if (entry.type === "DEBIT") summary.spent += Math.abs(entry.amount);
    summaries.set(entry.teamId, summary);
  }

  return summaries;
}

/** Running balance + total spent, derived from the ledger (not Player docs). */
export async function getLedgerSummary(teamId: string) {
  const entries = await WalletTransactions.find({ teamId });

  let remaining = 0;
  let spent = 0;
  for (const entry of entries) {
    remaining += entry.amount;
    if (entry.type === "DEBIT") spent += Math.abs(entry.amount);
  }
  return { remaining, spent, hasLedger: entries.length > 0 };
}

export async function getTeamLedger(teamId: string) {
  const entries = await WalletTransactions.find({ teamId });
  return entries.sort(byEntryOrder);
}

export async function hasStartingBalanceEntry(teamId: string) {
  return WalletTransactions.exists({ teamId, note: "Starting balance" });
}

export async function hasPurchaseEntry(teamId: string, playerId: string) {
  return WalletTransactions.exists({ teamId, playerId, type: "DEBIT" });
}
