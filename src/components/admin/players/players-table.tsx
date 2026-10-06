"use client";

import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import {
  PlayerFormDialog,
  type PlayerRecord,
} from "@/components/admin/players/player-form-dialog";
import { PlayerImportDialog } from "@/components/admin/players/player-import-dialog";
import { StatusBadge } from "@/components/admin/players/status-badge";
import type { CategoryRecord } from "@/components/admin/settings/category-form-dialog";
import type { TagRecord } from "@/components/admin/settings/tag-form-dialog";
import { PLAYER_ROLES, PLAYER_STATUSES } from "@/lib/constants";
import { Pencil, Search, Users } from "lucide-react";

const ALL = "ALL";

export function PlayersTable({
  initialPlayers,
  categories,
  tags,
}: {
  initialPlayers: PlayerRecord[];
  categories: CategoryRecord[];
  tags: TagRecord[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [roleFilter, setRoleFilter] = useState<string>(ALL);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialPlayers.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (statusFilter !== ALL && p.status !== statusFilter) return false;
      if (roleFilter !== ALL && p.role !== roleFilter) return false;
      if (categoryFilter !== ALL) {
        const categoryId =
          typeof p.categoryId === "object" && p.categoryId
            ? p.categoryId._id
            : p.categoryId;
        if (categoryId !== categoryFilter) return false;
      }
      return true;
    });
  }, [initialPlayers, search, statusFilter, roleFilter, categoryFilter]);

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== ALL ||
    roleFilter !== ALL ||
    categoryFilter !== ALL;

  async function handleDelete(id: string) {
    const res = await fetch(`/api/players/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not delete player");
      return;
    }
    toast.success("Player deleted");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? ALL)}>
              <SelectTrigger className="w-36">
                <SelectValue>
                  {(v) => (v === ALL ? "All statuses" : v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {PLAYER_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v ?? ALL)}>
              <SelectTrigger className="w-36">
                <SelectValue>{(v) => (v === ALL ? "All roles" : v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All roles</SelectItem>
                {PLAYER_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? ALL)}>
              <SelectTrigger className="w-40">
                <SelectValue>
                  {(v) =>
                    v === ALL
                      ? "All categories"
                      : categories.find((c) => c._id === v)?.name ?? "All categories"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <PlayerImportDialog
              categories={categories}
              tags={tags}
              onSaved={() => router.refresh()}
            />
            <PlayerFormDialog
              categories={categories}
              tags={tags}
              onSaved={() => router.refresh()}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Users className="size-8" />
            <p className="text-sm">
              {initialPlayers.length === 0
                ? "No players yet. Add your first player to build the catalog."
                : hasActiveFilters
                  ? "No players match your filters."
                  : "No players match your search."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((player) => {
                const category =
                  typeof player.categoryId === "object" ? player.categoryId : null;
                const basePrice =
                  player.basePriceOverride ?? category?.defaultBasePrice ?? 0;
                const playerTags = player.tagIds.filter(
                  (t): t is TagRecord => typeof t === "object"
                );

                return (
                  <TableRow key={player._id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="rounded-lg">
                          {player.avatarUrl && (
                            <AvatarImage src={player.avatarUrl} alt="" />
                          )}
                          <AvatarFallback className="rounded-lg bg-secondary">
                            {player.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium leading-tight">{player.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {player.role}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{category?.name ?? "No category"}</TableCell>
                    <TableCell className="tabular-money font-medium text-primary">
                      ₹{basePrice.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell>
                      {playerTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {playerTags.map((tag) => (
                            <Badge
                              key={tag._id}
                              className="border-0 text-[10px] font-semibold uppercase tracking-wide"
                              style={{
                                backgroundColor: `${tag.color}26`,
                                color: tag.color,
                              }}
                            >
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={player.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <PlayerFormDialog
                          player={player}
                          categories={categories}
                          tags={tags}
                          onSaved={() => router.refresh()}
                          trigger={
                            <Button variant="ghost" size="icon">
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        <ConfirmDeleteDialog
                          title="Delete player?"
                          description={`"${player.name}" will be permanently removed from the catalog.`}
                          onConfirm={() => handleDelete(player._id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
