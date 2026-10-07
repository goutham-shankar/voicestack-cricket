import { collection, type Doc } from "@/lib/db";

export const WALLET_TRANSACTION_TYPES = ["CREDIT", "DEBIT", "ADJUSTMENT"] as const;

export type WalletTransactionType = (typeof WALLET_TRANSACTION_TYPES)[number];

export type WalletTransaction = {
  teamId: string;
  type: WalletTransactionType;
  /** Signed: CREDIT/ADJUSTMENT-up are positive, DEBIT/ADJUSTMENT-down negative. */
  amount: number;
  balanceAfter: number;
  playerId: string | null;
  note: string;
  /**
   * Position in this team's ledger, starting at 1. A compound unique index on
   * (teamId, seq) is what makes the append atomic: two concurrent purchases
   * both computing the same next number means one of them is rejected and
   * retries against the balance the winner wrote.
   */
  seq: number;
};

export type WalletTransactionDoc = Doc<WalletTransaction>;

export const WalletTransactions = collection<WalletTransaction>({
  name: "walletTransactions",
  defaults: () => ({
    teamId: "",
    type: "DEBIT",
    amount: 0,
    balanceAfter: 0,
    playerId: null,
    note: "",
    seq: 0,
  }),
  uniqueCompound: [["teamId", "seq"]],
});
