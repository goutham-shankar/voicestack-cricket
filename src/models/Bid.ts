import { Schema, model, models, type InferSchemaType } from "mongoose";

const bidSchema = new Schema(
  {
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    amount: { type: Number, required: true },
    /** Scopes bids to a single live lot / reset cycle without deleting history. */
    lotKey: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

bidSchema.index({ playerId: 1, lotKey: 1, createdAt: -1 });
bidSchema.index({ playerId: 1, createdAt: -1 });

export type Bid = InferSchemaType<typeof bidSchema>;

export default models.Bid || model("Bid", bidSchema);
