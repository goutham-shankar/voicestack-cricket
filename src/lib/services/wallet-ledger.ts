import { Types } from "mongoose";
import WalletTransactionModel, {
  WALLET_TRANSACTION_TYPES,
} from "@/models/WalletTransaction";

type TxnType = (typeof WALLET_TRANSACTION_TYPES)[number];

/**
 * Appends one immutable ledger entry for a team and returns it.
 * `amount` is signed: positive credits the wallet, negative debits it.
 * Not wrapped in a DB transaction (matches the rest of the auction service,
 * which relies on single atomic findOneAndUpdate claims rather than
 * multi-document transactions) — entries are written strictly after the
 * state change they record, so the ledger can only ever lag, never diverge.
 */
export async function recordTransaction({
  teamId,
  type,
  amount,
  note,
  playerId,
}: {
  teamId: string;
  type: TxnType;
  amount: number;
  note: string;
  playerId?: string | null;
}) {
  const last = await WalletTransactionModel.findOne({ teamId })
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  const previousBalance = last?.balanceAfter ?? 0;
  const balanceAfter = previousBalance + amount;

  return WalletTransactionModel.create({
    teamId: new Types.ObjectId(teamId),
    type,
    amount,
    balanceAfter,
    playerId: playerId ? new Types.ObjectId(playerId) : null,
    note,
  });
}

/** Bulk version of getLedgerSummary for every team in one aggregation. */
export async function getAllLedgerSummaries() {
  const rows = await WalletTransactionModel.aggregate([
    {
      $group: {
        _id: "$teamId",
        remaining: { $sum: "$amount" },
        spent: {
          $sum: {
            $cond: [{ $eq: ["$type", "DEBIT"] }, { $abs: "$amount" }, 0],
          },
        },
      },
    },
  ]);
  return new Map(
    rows.map((r) => [String(r._id), { remaining: r.remaining, spent: r.spent }])
  );
}

/** Running balance + total spent, derived from the ledger (not Player docs). */
export async function getLedgerSummary(teamId: string) {
  const txns = await WalletTransactionModel.find({ teamId })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  let remaining = 0;
  let spent = 0;
  for (const txn of txns) {
    remaining += txn.amount;
    if (txn.type === "DEBIT") spent += Math.abs(txn.amount);
  }
  return { remaining, spent, hasLedger: txns.length > 0 };
}

export async function getTeamLedger(teamId: string) {
  return WalletTransactionModel.find({ teamId })
    .sort({ createdAt: 1, _id: 1 })
    .populate("playerId")
    .lean();
}

export async function hasStartingBalanceEntry(teamId: string) {
  return WalletTransactionModel.exists({ teamId, note: "Starting balance" });
}

export async function hasPurchaseEntry(teamId: string, playerId: string) {
  return WalletTransactionModel.exists({ teamId, playerId, type: "DEBIT" });
}
