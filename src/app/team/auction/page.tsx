import { auth } from "@/auth";
import { getUserTeam } from "@/lib/session-team";
import { AuctionRoom } from "@/components/auction/auction-room";

export default async function TeamAuctionPage() {
  const session = await auth();
  const team = await getUserTeam(session?.user?.id);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <AuctionRoom
        role="team"
        myTeam={team ? { _id: String(team._id), name: team.name } : null}
      />
    </div>
  );
}
