import { auth } from "@/auth";
import { getUserTeam } from "@/lib/session-team";
import { AuctionRoom } from "@/components/auction/auction-room";

export default async function TeamAuctionPage() {
  const session = await auth();
  const team = await getUserTeam(session?.user?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Live Auction</h1>
        <p className="text-sm text-muted-foreground">
          {team
            ? `Live view for ${team.name}. Watch the timer, wallet and squad update in real time.`
            : "Your account is not linked to a team — contact an admin."}
        </p>
      </div>
      <AuctionRoom
        role="team"
        myTeam={team ? { _id: String(team._id), name: team.name } : null}
      />
    </div>
  );
}
