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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import {
  CategoryFormDialog,
  type CategoryRecord,
} from "@/components/admin/settings/category-form-dialog";
import { Pencil } from "lucide-react";

export function CategoriesPanel({
  initialCategories,
}: {
  initialCategories: CategoryRecord[];
}) {
  const router = useRouter();

  async function handleDelete(id: string) {
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not delete category");
      return;
    }
    toast.success("Category deleted");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Player Categories</CardTitle>
        <CardAction>
          <CategoryFormDialog onSaved={() => router.refresh()} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {initialCategories.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No categories yet. Add one to start pricing players.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Default Base Price</TableHead>
                <TableHead>Round</TableHead>
                <TableHead>Per Team</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialCategories.map((cat) => (
                <TableRow key={cat._id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell className="tabular-money">
                    ₹{cat.defaultBasePrice.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell>{cat.order}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    min {cat.minPerTeam ?? 0} · max{" "}
                    {cat.maxPerTeam == null ? "unlimited" : cat.maxPerTeam}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <CategoryFormDialog
                        category={cat}
                        onSaved={() => router.refresh()}
                        trigger={
                          <Button variant="ghost" size="icon">
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      <ConfirmDeleteDialog
                        title="Delete category?"
                        description={`"${cat.name}" will be permanently removed. This fails if any player still uses it.`}
                        onConfirm={() => handleDelete(cat._id)}
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
