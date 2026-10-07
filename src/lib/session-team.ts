import { cache } from "react";
import { Users } from "@/models/User";
import { Teams } from "@/models/Team";

/**
 * Fresh franchise link from the database (not the possibly-stale JWT claim).
 *
 * Both of these are wrapped in React's `cache`, so the layout and the page it
 * renders share one lookup per request instead of each paying its own round
 * trip. Without it a single team page costs four sequential queries to Atlas
 * before it reads any actual data, and on a serverless host that is most of
 * what the user experiences as navigation lag.
 */
export const getUserTeamId = cache(async (userId: string | undefined | null) => {
  if (!userId) return null;
  const user = await Users.findById(userId);
  return user?.teamId ?? null;
});

export const getUserTeam = cache(async (userId: string | undefined | null) => {
  const teamId = await getUserTeamId(userId);
  if (!teamId) return null;
  return Teams.findById(teamId);
});
