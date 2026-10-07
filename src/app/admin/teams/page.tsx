import { Users } from "@/models/User";
import { Players } from "@/models/Player";
import { getSingleton } from "@/lib/db";
import { FEMALE_CAPTAINS_PER_TEAM } from "@/lib/auction-engine";
import { getTeams } from "@/lib/services/catalog";
import { AuctionSettingsStore } from "@/models/AuctionSettings";
import { TeamsTable } from "@/components/admin/teams/teams-table";

function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export default async function AdminTeamsPage() {
  const [teams, teamUsers, soldFemale, settings] = await Promise.all([
    getTeams(),
    Users.find({ role: "team" }),
    Players.find({ status: "SOLD", gender: "F" }),
    getSingleton(AuctionSettingsStore),
  ]);

  const loginByTeamId = new Map(
    teamUsers.map((user) => [user.teamId, user.email])
  );
  const femaleByTeam = new Map<string, number>();
  for (const player of soldFemale) {
    if (!player.soldToTeamId) continue;
    femaleByTeam.set(
      player.soldToTeamId,
      (femaleByTeam.get(player.soldToTeamId) ?? 0) + 1
    );
  }
  const femaleCaptains = (settings.captainsCount ?? true)
    ? FEMALE_CAPTAINS_PER_TEAM
    : 0;

  const teamsWithLogin = teams.map((team) => ({
    ...team,
    loginEmail: loginByTeamId.get(team._id) ?? null,
    femaleCount: (femaleByTeam.get(team._id) ?? 0) + femaleCaptains,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Teams</h1>
        <p className="text-sm text-muted-foreground">
          Create teams, set wallets and squad limits, and optionally provision a
          team login.
        </p>
      </div>

      <TeamsTable
        initialTeams={serialize(teamsWithLogin)}
        minFemalePlayers={settings.minFemalePlayers ?? 5}
      />
    </div>
  );
}
