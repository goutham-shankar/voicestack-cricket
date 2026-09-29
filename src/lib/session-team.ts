import { connectDB } from "@/lib/db";
import UserModel from "@/models/User";
import TeamModel from "@/models/Team";

/** Fresh franchise link from DB (not the possibly-stale JWT claim). */
export async function getUserTeamId(userId: string | undefined | null) {
  if (!userId) return null;
  await connectDB();
  const user = await UserModel.findById(userId).select("teamId").lean();
  return user?.teamId ? String(user.teamId) : null;
}

export async function getUserTeam(
  userId: string | undefined | null,
  select?: string
) {
  const teamId = await getUserTeamId(userId);
  if (!teamId) return null;
  const query = TeamModel.findById(teamId);
  if (select) query.select(select);
  return query.lean();
}
