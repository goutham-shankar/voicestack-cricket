import { Schema, model, models, type InferSchemaType } from "mongoose";

const teamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    logoUrl: { type: String, default: null },
    initialBudget: { type: Number, required: true, default: 100000 },
    maxSquadSize: { type: Number, required: true, default: 12 },
  },
  { timestamps: true }
);

export type Team = InferSchemaType<typeof teamSchema>;

export default models.Team || model("Team", teamSchema);
