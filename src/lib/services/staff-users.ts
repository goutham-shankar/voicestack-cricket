import { Teams } from "@/models/Team";
import { Users, type UserDoc } from "@/models/User";
import type { STAFF_ROLES } from "@/lib/constants";

type StaffRole = (typeof STAFF_ROLES)[number];

/** What the admin Users table reads: no password hash, team resolved to a document. */
export type StaffUserDTO = {
  _id: string;
  name: string;
  email: string;
  role: StaffRole;
  teamId: { _id: string; name: string } | null;
  createdAt: Date;
};

/** Resolves the franchise link for a set of staff users in one read. */
export async function toStaffUserDTOs(users: UserDoc[]): Promise<StaffUserDTO[]> {
  const teamIds = [...new Set(users.map((user) => user.teamId).filter(Boolean))];
  const teams = await Promise.all(teamIds.map((id) => Teams.findById(id as string)));
  const byId = new Map(
    teams.filter(Boolean).map((team) => [team!._id, { _id: team!._id, name: team!.name }])
  );

  return users.map((user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role as StaffRole,
    teamId: user.teamId ? (byId.get(user.teamId) ?? null) : null,
    createdAt: user.createdAt,
  }));
}

/** Admin and auctioneer logins, newest first. Team logins live on the Teams page. */
export async function listStaffUsers() {
  const users = await Users.find(
    { role: { $in: ["admin", "auctioneer"] } },
    { sort: { createdAt: -1 } }
  );
  return toStaffUserDTOs(users);
}
