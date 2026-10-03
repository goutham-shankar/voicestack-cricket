import { Schema, model, models, type InferSchemaType } from "mongoose";

const playerCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    defaultBasePrice: { type: Number, required: true, min: 0 },
    order: { type: Number, required: true, default: 0 },
    /** Mandatory slots each team must fill in this category. */
    minPerTeam: { type: Number, required: true, default: 0, min: 0 },
    /** Most a team may hold in this category; null means unlimited. */
    maxPerTeam: { type: Number, default: null, min: 0 },
  },
  { timestamps: true }
);

export type PlayerCategory = InferSchemaType<typeof playerCategorySchema>;

export default models.PlayerCategory ||
  model("PlayerCategory", playerCategorySchema);
