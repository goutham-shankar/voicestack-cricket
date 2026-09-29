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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { TeamFormDialog, type TeamRecord } from "@/components/admin/teams/team-form-dialog";
import { TeamLedgerDialog } from "@/components/admin/teams/team-ledger-dialog";
import { Pencil, Shield } from "lucide-react";

export function TeamsTable({ initialTeams }: { initialTeams: TeamRecord[] }) {
  const router = useRouter();

  async function handleDelete(id: string) {
    const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not delete team");
      return;
    }
    toast.success("Team deleted");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {initialTeams.length} team{initialTeams.length === 1 ? "" : "s"}
          </p>
          <TeamFormDialog onSaved={() => router.refresh()} />
        </div>

        {initialTeams.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Shield className="size-8" />
            <p className="text-sm">No teams yet. Add your first team to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Wallet Budget</TableHead>
                <TableHead>Max Squad</TableHead>
                <TableHead>Login</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialTeams.map((team) => (
                <TableRow key={team._id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="rounded-lg">
                        {team.logoUrl && <AvatarImage src={team.logoUrl} alt="" />}
                        <AvatarFallback className="rounded-lg bg-secondary">
                          {team.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{team.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-money">
                    ₹{team.initialBudget.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell>{team.maxSquadSize}</TableCell>
                  <TableCell>
                    {team.loginEmail ? (
                      <Badge variant="secondary" className="font-normal">
                        {team.loginEmail}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        not provisioned
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <TeamLedgerDialog teamId={team._id} teamName={team.name} />
                      <TeamFormDialog
                        team={team}
                        onSaved={() => router.refresh()}
                        trigger={
                          <Button variant="ghost" size="icon">
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      <ConfirmDeleteDialog
                        title="Delete team?"
                        description={`"${team.name}" will be permanently removed. This fails if it has a login or squad history.`}
                        onConfirm={() => handleDelete(team._id)}
                      />
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
