"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { tagSchema, type TagInput } from "@/lib/validators/tag";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from "lucide-react";

export type TagRecord = { _id: string; name: string; color: string };

const PRESET_COLORS = [
  "#d4a017",
  "#22c55e",
  "#ef4444",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];

export function TagFormDialog({
  tag,
  onSaved,
  trigger,
}: {
  tag?: TagRecord;
  onSaved: () => void;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(tag);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TagInput>({
    resolver: zodResolver(tagSchema),
    defaultValues: tag ?? { name: "", color: PRESET_COLORS[0] },
  });

  const color = watch("color");

  async function onSubmit(values: TagInput) {
    setLoading(true);
    try {
      const res = await fetch(isEdit ? `/api/tags/${tag!._id}` : "/api/tags", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.formErrors?.[0] ?? data.error ?? "Something went wrong");
        return;
      }
      toast.success(isEdit ? "Tag updated" : "Tag created");
      setOpen(false);
      if (!isEdit) reset({ name: "", color: PRESET_COLORS[0] });
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
        if (next) reset(tag ?? { name: "", color: PRESET_COLORS[0] });
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus className="size-4" />
              Add Tag
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Tag" : "Add Tag"}</DialogTitle>
          <DialogDescription>
            Tags are special classifications shown on a player&apos;s profile, like
            Mentor or Power Player.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">Name</Label>
            <Input id="tag-name" placeholder="Power Player" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setValue("color", c, { shouldValidate: true })}
                  className="size-7 rounded-full ring-offset-2 ring-offset-background transition-shadow"
                  style={{
                    backgroundColor: c,
                    boxShadow: color === c ? `0 0 0 2px ${c}` : undefined,
                  }}
                  aria-label={c}
                />
              ))}
              <Input
                type="text"
                className="ml-2 w-28 font-mono text-xs"
                {...register("color")}
              />
            </div>
            {errors.color && (
              <p className="text-sm text-destructive">{errors.color.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Tag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
