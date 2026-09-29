import { connectDB } from "@/lib/db";
import TeamModel from "@/models/Team";
import UserModel from "@/models/User";
import { TeamsTable } from "@/components/admin/teams/teams-table";

function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export default async function AdminTeamsPage() {
  await connectDB();

  const teams = await TeamModel.find().sort({ name: 1 }).lean();
  const teamUsers = await UserModel.find({ role: "team" })
    .select("teamId email")
    .lean();

  const loginByTeamId = new Map(
    teamUsers.map((u) => [String(u.teamId), u.email])
  );

  const teamsWithLogin = teams.map((t) => ({
    ...t,
    loginEmail: loginByTeamId.get(String(t._id)) ?? null,
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
