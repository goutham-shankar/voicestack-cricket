import { Users } from "@/models/User";
import { getTeams } from "@/lib/services/catalog";
import { TeamsTable } from "@/components/admin/teams/teams-table";

function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export default async function AdminTeamsPage() {
  const [teams, teamUsers] = await Promise.all([
    getTeams(),
    Users.find({ role: "team" }),
  ]);

  const loginByTeamId = new Map(
    teamUsers.map((user) => [user.teamId, user.email])
  );

  const teamsWithLogin = teams.map((team) => ({
    ...team,
    loginEmail: loginByTeamId.get(team._id) ?? null,
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

      <TeamsTable initialTeams={serialize(teamsWithLogin)} />
    </div>
  );
}
