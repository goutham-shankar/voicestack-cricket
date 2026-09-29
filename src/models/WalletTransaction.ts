import { Schema, model, models, type InferSchemaType } from "mongoose";

export const WALLET_TRANSACTION_TYPES = ["CREDIT", "DEBIT", "ADJUSTMENT"] as const;

const walletTransactionSchema = new Schema(
  {
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    type: { type: String, enum: WALLET_TRANSACTION_TYPES, required: true },
    // Signed: CREDIT/ADJUSTMENT-up are positive, DEBIT/ADJUSTMENT-down are negative.
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", default: null },
    note: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ teamId: 1, createdAt: 1 });

export type WalletTransaction = InferSchemaType<typeof walletTransactionSchema>;

export default models.WalletTransaction ||
  model("WalletTransaction", walletTransactionSchema);
