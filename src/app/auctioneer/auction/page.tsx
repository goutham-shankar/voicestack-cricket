import { auth } from "@/auth";
import { getUserTeam } from "@/lib/session-team";
import { AuctionRoom } from "@/components/auction/auction-room";

export default async function AuctioneerAuctionPage() {
  const session = await auth();
  const team = await getUserTeam(session?.user?.id, "name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {team ? `${team.name} · Live Auction` : "Live Auction"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {team
            ? `Bid for ${team.name}. Watch your wallet and squad update as players are sold.`
            : "Your account is not linked to a team — ask an admin to assign one before bidding."}
        </p>
      </div>
      <AuctionRoom
        role="auctioneer"
        myTeam={team ? { _id: String(team._id), name: team.name } : null}
      />
    </div>
  );
}
