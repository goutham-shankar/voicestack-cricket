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
  minPerTeam?: number;
  maxPerTeam?: number | null;
};

/** Shared so the three reset sites below cannot drift apart. */
const BLANK_CATEGORY: CategoryInput = {
  name: "",
  defaultBasePrice: 1000,
  order: 0,
  minPerTeam: 0,
  maxPerTeam: null,
};

function toFormValues(category?: CategoryRecord): CategoryInput {
  if (!category) return BLANK_CATEGORY;
  return {
    name: category.name,
    defaultBasePrice: category.defaultBasePrice,
    order: category.order,
    minPerTeam: category.minPerTeam ?? 0,
    maxPerTeam: category.maxPerTeam ?? null,
  };
}

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
    defaultValues: toFormValues(category),
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
      if (!isEdit) reset(BLANK_CATEGORY);
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
        if (next) reset(toFormValues(category));
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
            <Label htmlFor="cat-order">Round Order</Label>
            <Input
              id="cat-order"
              type="number"
              {...register("order", { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">
              Rounds are auctioned in this order. The first round is always open,
              and it takes up whatever slack is left in the minimum squad size.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cat-min">Minimum per Team</Label>
              <Input
                id="cat-min"
                type="number"
                {...register("minPerTeam", { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">
                Each team must buy this many. Their base price is held back from
                every other bid.
              </p>
              {errors.minPerTeam && (
                <p className="text-sm text-destructive">
                  {errors.minPerTeam.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-max">Maximum per Team</Label>
              <Input
                id="cat-max"
                type="number"
                placeholder="No limit"
                {...register("maxPerTeam", {
                  setValueAs: (v) =>
                    v === "" || v === null ? null : Number(v),
                })}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank for no limit.
              </p>
              {errors.maxPerTeam && (
                <p className="text-sm text-destructive">
                  {errors.maxPerTeam.message}
                </p>
              )}
            </div>
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
