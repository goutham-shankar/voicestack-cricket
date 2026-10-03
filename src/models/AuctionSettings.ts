import { Schema, model, models, type InferSchemaType } from "mongoose";

const auctionSettingsSchema = new Schema(
  {
    singleton: { type: String, required: true, unique: true, default: "global" },
    defaultWalletBudget: { type: Number, required: true, default: 100000 },
    defaultMaxSquadSize: { type: Number, required: true, default: 12 },
    timerSeconds: { type: Number, required: true, default: 30 },
    /** Smallest squad every team must end up with, captains included when they count. */
    minSquadSize: { type: Number, required: true, default: 12 },
    /** How much each bid must rise by. */
    bidIncrement: { type: Number, required: true, default: 500 },
    /** Whether the two captains occupy mandatory squad slots. */
    captainsCount: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

export type AuctionSettings = InferSchemaType<typeof auctionSettingsSchema>;

export default models.AuctionSettings ||
  model("AuctionSettings", auctionSettingsSchema);
