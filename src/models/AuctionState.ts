import { Schema, model, models, type InferSchemaType } from "mongoose";

export const AUCTION_STATUSES = ["IDLE", "LIVE"] as const;

const auctionStateSchema = new Schema(
  {
    singleton: { type: String, required: true, unique: true, default: "global" },
    status: { type: String, enum: AUCTION_STATUSES, required: true, default: "IDLE" },
    currentPlayerId: { type: Schema.Types.ObjectId, ref: "Player", default: null },
    currentBid: { type: Number, default: 0 },
    currentBidTeamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    bidCount: { type: Number, default: 0 },
    lotKey: { type: String, default: null },
    timerEnabled: { type: Boolean, default: true },
    timerEndsAt: { type: Date, default: null },
    timerRemainingMs: { type: Number, default: null },
    timerPaused: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type AuctionState = InferSchemaType<typeof auctionStateSchema>;

export default models.AuctionState || model("AuctionState", auctionStateSchema);
