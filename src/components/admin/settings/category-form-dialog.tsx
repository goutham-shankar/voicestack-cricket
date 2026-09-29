"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { categorySchema, type CategoryInput } from "@/lib/validators/category";
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

export type CategoryRecord = {
  _id: string;
  name: string;
  defaultBasePrice: number;
  order: number;
};

export function CategoryFormDialog({
  category,
  onSaved,
  trigger,
}: {
  category?: CategoryRecord;
  onSaved: () => void;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(category);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: category ?? { name: "", defaultBasePrice: 1000, order: 0 },
  });

  async function onSubmit(values: CategoryInput) {
    setLoading(true);
    try {
      const res = await fetch(
        isEdit ? `/api/categories/${category!._id}` : "/api/categories",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.formErrors?.[0] ?? data.error ?? "Something went wrong");
        return;
      }
      toast.success(isEdit ? "Category updated" : "Category created");
      setOpen(false);
      if (!isEdit) reset({ name: "", defaultBasePrice: 1000, order: 0 });
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
        if (next) reset(category ?? { name: "", defaultBasePrice: 1000, order: 0 });
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus className="size-4" />
              Add Category
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Category" : "Add Category"}</DialogTitle>
          <DialogDescription>
            Categories set a default base price for every player assigned to them.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" placeholder="Intermediate" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat-price">Default Base Price (₹)</Label>
            <Input
              id="cat-price"
              type="number"
              {...register("defaultBasePrice", { valueAsNumber: true })}
            />
            {errors.defaultBasePrice && (
              <p className="text-sm text-destructive">
                {errors.defaultBasePrice.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat-order">Display Order</Label>
            <Input
              id="cat-order"
              type="number"
              {...register("order", { valueAsNumber: true })}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
