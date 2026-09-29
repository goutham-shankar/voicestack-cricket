"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { TagFormDialog, type TagRecord } from "@/components/admin/settings/tag-form-dialog";
import { Pencil, X } from "lucide-react";

export function TagsPanel({ initialTags }: { initialTags: TagRecord[] }) {
  const router = useRouter();

  async function handleDelete(id: string) {
    const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not delete tag");
      return;
    }
    toast.success("Tag deleted");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Player Tags</CardTitle>
        <CardAction>
          <TagFormDialog onSaved={() => router.refresh()} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {initialTags.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No tags yet. Add classifications like Mentor or Super Player.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {initialTags.map((tag) => (
              <div
                key={tag._id}
                className="group flex items-center gap-1 rounded-full border border-border py-0.5 pl-1 pr-1"
              >
                <Badge
                  className="border-0 font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: `${tag.color}26`,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </Badge>
                <TagFormDialog
                  tag={tag}
                  onSaved={() => router.refresh()}
                  trigger={
                    <Button variant="ghost" size="icon" className="size-6">
                      <Pencil className="size-3" />
                    </Button>
                  }
                />
                <ConfirmDeleteDialog
                  title="Delete tag?"
                  description={`"${tag.name}" will be removed from all players that have it.`}
                  onConfirm={() => handleDelete(tag._id)}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-destructive"
                    >
                      <X className="size-3" />
                    </Button>
                  }
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
