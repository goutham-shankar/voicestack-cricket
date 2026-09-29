import { auth } from "@/auth";
import { AdminSidebar } from "@/components/admin/sidebar";
import { UserMenu } from "@/components/user-menu";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex h-svh w-full overflow-hidden">
      <AdminSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card/40 px-4 md:px-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Admin
            </span>
          </div>
          <UserMenu name={session?.user?.name ?? "Admin"} role="admin" />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
