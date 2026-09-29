import { type DefaultSession } from "next-auth";
import type { USER_ROLES } from "@/lib/constants";

type UserRole = (typeof USER_ROLES)[number];

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      teamId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    teamId: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: UserRole;
    teamId: string | null;
  }
}
