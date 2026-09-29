import { auth } from "@/auth";
import { getUserTeam } from "@/lib/session-team";
import { TeamTopbar } from "@/components/team/topbar";

export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const team = await getUserTeam(session?.user?.id);

  return (
    <div className="flex min-h-svh w-full flex-col">
      <TeamTopbar
        name={session?.user?.name ?? "Team"}
        teamName={team?.name ?? "Unassigned Team"}
      />
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
