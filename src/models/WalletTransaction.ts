import { collection, type Doc } from "@/lib/firestore";

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
  }),
});
