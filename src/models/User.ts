import { collection, type Doc } from "@/lib/db";
import type { USER_ROLES } from "@/lib/constants";

export type UserRole = (typeof USER_ROLES)[number];

export type User = {
  email: string;
  passwordHash: string;
  role: UserRole;
  name: string;
  teamId: string | null;
};

export type UserDoc = Doc<User>;

export const Users = collection<User>({
  name: "users",
  unique: ["email"],
  defaults: () => ({
    email: "",
    passwordHash: "",
    role: "team",
    name: "",
    teamId: null,
  }),
});
