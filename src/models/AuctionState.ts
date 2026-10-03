import { Schema, model, models, type InferSchemaType } from "mongoose";

export const AUCTION_STATUSES = ["IDLE", "LIVE"] as const;

/** One bid on the current lot. Replaced wholesale when a lot opens or closes. */
const bidSchema = new Schema(
  {
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    amount: { type: Number, required: true, min: 0 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

/** The last settled lot, kept so the board can show its SOLD/UNSOLD stamp. */
const lastResultSchema = new Schema(
  {
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    kind: { type: String, enum: ["SOLD", "UNSOLD"], required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    amount: { type: Number, default: null },
    /** Changes per result, so the stamp animation replays exactly once. */
    key: { type: String, required: true },
  },
  { _id: false }
);

const auctionStateSchema = new Schema(
  {
    singleton: { type: String, required: true, unique: true, default: "global" },
    status: { type: String, enum: AUCTION_STATUSES, required: true, default: "IDLE" },
    currentPlayerId: { type: Schema.Types.ObjectId, ref: "Player", default: null },
    timerEnabled: { type: Boolean, default: true },
    timerEndsAt: { type: Date, default: null },
    timerRemainingMs: { type: Number, default: null },
    timerPaused: { type: Boolean, default: false },
    /** Final-squads showcase on the display board, driven by the admin. */
    showcase: { type: Boolean, default: false },

    /** Categories whose round has been opened. The first round is always open. */
    openCategoryIds: [{ type: Schema.Types.ObjectId, ref: "PlayerCategory" }],
    /** The round being auctioned now. */
    currentCategoryId: {
      type: Schema.Types.ObjectId,
      ref: "PlayerCategory",
      default: null,
    },
    /** Bids on the current lot, oldest first. The last one is the standing bid. */
    bids: { type: [bidSchema], default: [] },
    /** Lot counter, shown on the board as "Lot N". */
    lotNo: { type: Number, default: 0 },
    lastResult: { type: lastResultSchema, default: null },
  },
  { timestamps: true }
);

export type AuctionState = InferSchemaType<typeof auctionStateSchema>;

export default models.AuctionState || model("AuctionState", auctionStateSchema);
