import { auth } from "@/auth";
import { getUserTeam } from "@/lib/session-team";
import { UserMenu } from "@/components/user-menu";
import { BrandLogo } from "@/components/brand-logo";

export default async function AuctioneerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const team = await getUserTeam(session?.user?.id, "name");

  return (
    <div className="flex min-h-svh w-full flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card/60 px-4 backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          <BrandLogo size={32} />
          <div className="leading-tight">
            <p className="text-sm font-semibold">Voicestack Cricket League</p>
            <p className="text-xs text-muted-foreground">
              {team ? team.name : "Auctioneer"} · Bidding desk
            </p>
          </div>
        </div>
        <UserMenu name={session?.user?.name ?? "Auctioneer"} role="auctioneer" />
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
