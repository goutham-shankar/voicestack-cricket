import { Schema, model, models, type InferSchemaType } from "mongoose";
import { USER_ROLES } from "@/lib/constants";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, required: true },
    name: { type: String, required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
  },
  { timestamps: true }
);

export type User = InferSchemaType<typeof userSchema>;

export default models.User || model("User", userSchema);
