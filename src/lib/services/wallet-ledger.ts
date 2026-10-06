import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase";
import { WalletTransactions, type WalletTransactionType } from "@/models/WalletTransaction";

/** Ledger order: by write time, with the document id breaking exact ties. */
function byEntryOrder(
  a: { createdAt: Date; _id: string },
  b: { createdAt: Date; _id: string }
) {
  const byTime = a.createdAt.getTime() - b.createdAt.getTime();
  return byTime !== 0 ? byTime : a._id.localeCompare(b._id);
}

/**
 * Appends one immutable ledger entry for a team and returns it.
 * `amount` is signed: positive credits the wallet, negative debits it.
 *
 * The running balance is read and the entry appended inside one Firestore
 * transaction, so two concurrent purchases cannot both derive `balanceAfter`
 * from the same previous entry.
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
  const docRef = WalletTransactions.ref().doc();

  return getDb().runTransaction(async (txn) => {
    const existing = await txn.get(
      WalletTransactions.ref().where("teamId", "==", teamId)
    );
    const entries = existing.docs
      .map((doc) => WalletTransactions.hydrate(doc))
      .sort(byEntryOrder);

    const previousBalance = entries.at(-1)?.balanceAfter ?? 0;
    const balanceAfter = previousBalance + amount;
    const now = Timestamp.now();

    const payload = {
      teamId,
      type,
      amount,
      balanceAfter,
      playerId: playerId ?? null,
      note,
      createdAt: now,
      updatedAt: now,
    };
    txn.create(docRef, payload);

    return { ...payload, _id: docRef.id, createdAt: now.toDate(), updatedAt: now.toDate() };
  });
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
