import { auth } from "@/auth";
import { getTeams } from "@/lib/services/catalog";
import { listStaffUsers } from "@/lib/services/staff-users";
import { UsersTable } from "@/components/admin/users/users-table";

function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export default async function AdminUsersPage() {
  const session = await auth();

  const [users, teams] = await Promise.all([
    listStaffUsers(),
    getTeams(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Admin and auctioneer logins. Team logins are managed from the Teams page.
        </p>
      </div>

      <UsersTable
        initialUsers={serialize(users)}
        teams={serialize(teams)}
        currentUserId={session!.user.id}
      />
    </div>
  );
}
