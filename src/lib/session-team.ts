import { Users } from "@/models/User";
import { Teams } from "@/models/Team";

/** Fresh franchise link from the database (not the possibly-stale JWT claim). */
export async function getUserTeamId(userId: string | undefined | null) {
  if (!userId) return null;
  const user = await Users.findById(userId);
  return user?.teamId ?? null;
}

export async function getUserTeam(userId: string | undefined | null) {
  const teamId = await getUserTeamId(userId);
  if (!teamId) return null;
  return Teams.findById(teamId);
}
