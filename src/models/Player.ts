import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PLAYER_ROLES, PLAYER_STATUSES } from "@/lib/constants";

const playerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: null },
    role: { type: String, enum: PLAYER_ROLES, required: true },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "PlayerCategory",
      required: true,
    },
    basePriceOverride: { type: Number, default: null, min: 0 },
    tagIds: [{ type: Schema.Types.ObjectId, ref: "PlayerTag" }],
    info: { type: String, default: "" },
    status: {
      type: String,
      enum: PLAYER_STATUSES,
      required: true,
      default: "PENDING",
    },
    soldToTeamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    soldPrice: { type: Number, default: null },
  },
  { timestamps: true }
);

export type Player = InferSchemaType<typeof playerSchema>;

export default models.Player || model("Player", playerSchema);
