import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import UserModel from "@/models/User";
import TeamModel from "@/models/Team";
import { UsersTable } from "@/components/admin/users/users-table";

function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export default async function AdminUsersPage() {
  const session = await auth();
  await connectDB();

  const [users, teams] = await Promise.all([
    UserModel.find({ role: { $in: ["admin", "auctioneer"] } })
      .select("name email role teamId")
      .populate("teamId")
      .sort({ createdAt: -1 })
      .lean(),
    TeamModel.find().sort({ name: 1 }).lean(),
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
