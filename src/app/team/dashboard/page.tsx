import { auth } from "@/auth";
import { getUserTeam } from "@/lib/session-team";
import { getTeamFinancials } from "@/lib/services/auction-service";
import { StatCard } from "@/components/stat-card";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Users2, Trophy } from "lucide-react";

export default async function TeamDashboardPage() {
  const session = await auth();
  const team = await getUserTeam(session?.user?.id);
  const teamId = team ? String(team._id) : null;

  const { spent, squadCount } = teamId
    ? await getTeamFinancials(teamId)
    : { spent: 0, squadCount: 0 };

  const initialBudget = team?.initialBudget ?? 0;
  const remaining = initialBudget - spent;
  const maxSquadSize = team?.maxSquadSize ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {team?.name ?? "Your Team"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Wallet, squad and live auction status.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Remaining Wallet"
          value={`₹${remaining.toLocaleString("en-IN")}`}
          icon={Wallet}
          accent="gold"
        />
        <StatCard
          label="Squad"
          value={`${squadCount} / ${maxSquadSize}`}
          icon={Users2}
        />
        <StatCard label="Players Won" value={squadCount} icon={Trophy} accent="sold" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={initialBudget ? (spent / initialBudget) * 100 : 0} />
          <div className="flex justify-between text-xs text-muted-foreground tabular-money">
            <span>Spent ₹{spent.toLocaleString("en-IN")}</span>
            <span>Budget ₹{initialBudget.toLocaleString("en-IN")}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
