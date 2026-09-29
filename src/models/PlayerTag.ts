import { Schema, model, models, type InferSchemaType } from "mongoose";

const playerTagSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    color: { type: String, required: true, default: "#d4a017" },
  },
  { timestamps: true }
);

export type PlayerTag = InferSchemaType<typeof playerTagSchema>;

export default models.PlayerTag || model("PlayerTag", playerTagSchema);
