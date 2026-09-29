"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { UserFormDialog } from "@/components/admin/users/user-form-dialog";
import { UserCog } from "lucide-react";

export type StaffUserRecord = {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "auctioneer";
  teamId: { _id: string; name: string } | null;
};

export function UsersTable({
  initialUsers,
  teams,
  currentUserId,
}: {
  initialUsers: StaffUserRecord[];
  teams: { _id: string; name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();

  async function handleDelete(id: string) {
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not delete user");
      return;
    }
    toast.success("User deleted");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {initialUsers.length} user{initialUsers.length === 1 ? "" : "s"}
          </p>
          <UserFormDialog teams={teams} onSaved={() => router.refresh()} />
        </div>

        {initialUsers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <UserCog className="size-8" />
            <p className="text-sm">
              No admin or auctioneer accounts yet besides your own.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialUsers.map((user) => (
                <TableRow key={user._id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-secondary text-xs">
                          {user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {user.name}
                        {user._id === currentUserId && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="font-normal capitalize"
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.teamId?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <UserFormDialog
                        user={user}
                        teams={teams}
                        lockRole={user._id === currentUserId}
                        onSaved={() => router.refresh()}
                      />
                      {user._id !== currentUserId && (
                        <ConfirmDeleteDialog
                          title="Delete user?"
                          description={`"${user.name}" will lose access immediately.`}
                          onConfirm={() => handleDelete(user._id)}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
