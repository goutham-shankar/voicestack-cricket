"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { playerSchema, type PlayerInput } from "@/lib/validators/player";
import { PLAYER_ROLES } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "@/components/admin/image-upload";
import { Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryRecord } from "@/components/admin/settings/category-form-dialog";
import type { TagRecord } from "@/components/admin/settings/tag-form-dialog";

export type PlayerRecord = {
  _id: string;
  name: string;
  avatarUrl: string | null;
  role: (typeof PLAYER_ROLES)[number];
  categoryId: { _id: string; name: string; defaultBasePrice: number } | string | null;
  basePriceOverride: number | null;
  tagIds: (TagRecord | string)[];
  info: string;
  status: "PENDING" | "LIVE" | "SOLD" | "UNSOLD";
};

export function PlayerFormDialog({
  player,
  categories,
  tags,
  onSaved,
  trigger,
}: {
  player?: PlayerRecord;
  categories: CategoryRecord[];
  tags: TagRecord[];
  onSaved: () => void;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [overrideEnabled, setOverrideEnabled] = useState(
    player?.basePriceOverride != null
  );
  const isEdit = Boolean(player);

  const defaultValues: PlayerInput = {
    name: player?.name ?? "",
    avatarUrl: player?.avatarUrl ?? null,
    role: player?.role ?? PLAYER_ROLES[0],
    categoryId:
      typeof player?.categoryId === "object" && player.categoryId
        ? player.categoryId._id
        : ((player?.categoryId as string | null | undefined) ?? ""),
    basePriceOverride: player?.basePriceOverride ?? null,
    tagIds:
      player?.tagIds.map((t) => (typeof t === "object" ? t._id : t)) ?? [],
    info: player?.info ?? "",
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PlayerInput>({
    resolver: zodResolver(playerSchema),
    defaultValues,
  });

  const avatarUrl = watch("avatarUrl");
  const categoryId = watch("categoryId");
  const tagIds = watch("tagIds");
  const selectedCategory = categories.find((c) => c._id === categoryId);

  function toggleTag(id: string) {
    const next = tagIds.includes(id)
      ? tagIds.filter((t) => t !== id)
      : [...tagIds, id];
    setValue("tagIds", next, { shouldDirty: true });
  }

  async function onSubmit(values: PlayerInput) {
    setLoading(true);
    try {
      const payload = {
        ...values,
        basePriceOverride: overrideEnabled ? values.basePriceOverride : null,
      };
      const res = await fetch(isEdit ? `/api/players/${player!._id}` : "/api/players", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const fieldError = Object.values(data.error?.fieldErrors ?? {})[0] as
          | string[]
          | undefined;
        toast.error(fieldError?.[0] ?? data.error ?? "Something went wrong");
        return;
      }
      toast.success(isEdit ? "Player updated" : "Player added");
      setOpen(false);
      if (!isEdit) {
        reset(defaultValues);
        setOverrideEnabled(false);
      }
      onSaved();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset(defaultValues);
          setOverrideEnabled(player?.basePriceOverride != null);
        }
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus className="size-4" />
              Add Player
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Player" : "Add Player"}</DialogTitle>
          <DialogDescription>
            Base price comes from the category by default and can be overridden.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Avatar</Label>
            <ImageUpload
              value={avatarUrl}
              onChange={(url) => setValue("avatarUrl", url, { shouldDirty: true })}
              scope="players"
              fallback={(player?.name ?? "P").slice(0, 2).toUpperCase()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="player-name">Player Name</Label>
            <Input id="player-name" placeholder="Rahul Kumar" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={watch("role")}
                onValueChange={(v) =>
                  setValue("role", v as PlayerInput["role"], { shouldDirty: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {PLAYER_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={categoryId}
                onValueChange={(v) =>
                  setValue("categoryId", v ?? "", { shouldDirty: true })
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v: string) =>
                      categories.find((c) => c._id === v)?.name ?? "Select category"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId && (
                <p className="text-sm text-destructive">{errors.categoryId.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="override-toggle">Override Base Price</Label>
                <p className="text-xs text-muted-foreground">
                  {selectedCategory
                    ? `Category default: ${selectedCategory.defaultBasePrice.toLocaleString("en-IN")}`
                    : "Choose a category to see its default price"}
                </p>
              </div>
              <Switch
                id="override-toggle"
                checked={overrideEnabled}
                onCheckedChange={setOverrideEnabled}
              />
            </div>
            {overrideEnabled && (
              <Input
                type="number"
                placeholder="Custom base price"
                {...register("basePriceOverride", { valueAsNumber: true })}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {tags.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No tags yet — add them in Configuration.
                </p>
              )}
              {tags.map((tag) => {
                const active = tagIds.includes(tag._id);
                return (
                  <button
                    key={tag._id}
                    type="button"
                    onClick={() => toggleTag(tag._id)}
                  >
                    <Badge
                      variant={active ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer select-none border-0 font-semibold uppercase tracking-wide transition-opacity",
                        !active && "opacity-50"
                      )}
                      style={
                        active
                          ? { backgroundColor: `${tag.color}26`, color: tag.color }
                          : undefined
                      }
                    >
                      {tag.name}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="player-info">Notes (optional)</Label>
            <Textarea id="player-info" rows={3} {...register("info")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Player"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
