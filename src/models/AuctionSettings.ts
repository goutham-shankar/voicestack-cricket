import { Schema, model, models, type InferSchemaType } from "mongoose";

const auctionSettingsSchema = new Schema(
  {
    singleton: { type: String, required: true, unique: true, default: "global" },
    defaultWalletBudget: { type: Number, required: true, default: 100000 },
    defaultMaxSquadSize: { type: Number, required: true, default: 12 },
    timerSeconds: { type: Number, required: true, default: 30 },
    minReservePerSlot: { type: Number, required: true, default: 1000 },
  },
  { timestamps: true }
);

export type AuctionSettings = InferSchemaType<typeof auctionSettingsSchema>;

export default models.AuctionSettings ||
  model("AuctionSettings", auctionSettingsSchema);
