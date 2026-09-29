"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  staffUserSchema,
  staffUserUpdateSchema,
  type StaffUserInput,
  type StaffUserUpdateInput,
} from "@/lib/validators/user";
import { STAFF_ROLES } from "@/lib/constants";
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
import { Loader2, Pencil, Plus } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  auctioneer: "Auctioneer",
};

type FormValues = StaffUserInput | StaffUserUpdateInput;

export type EditableStaffUser = {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "auctioneer";
  teamId: { _id: string; name: string } | null;
};

export function UserFormDialog({
  user,
  onSaved,
  teams,
  lockRole = false,
  trigger,
}: {
  user?: EditableStaffUser;
  onSaved: () => void;
  teams: { _id: string; name: string }[];
  /** When editing yourself, role cannot be changed. */
  lockRole?: boolean;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(user);

  const defaultValues: FormValues = {
    name: user?.name ?? "",
    email: user?.email ?? "",
    password: "",
    role: user?.role ?? "auctioneer",
    teamId: user?.teamId?._id ? String(user.teamId._id) : "",
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(isEdit ? staffUserUpdateSchema : staffUserSchema),
    defaultValues,
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const res = await fetch(isEdit ? `/api/users/${user!._id}` : "/api/users", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          teamId: values.teamId || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const fieldError = Object.values(data.error?.fieldErrors ?? {})[0] as
          | string[]
          | undefined;
        toast.error(
          fieldError?.[0] ??
            (typeof data.error === "string" ? data.error : "Something went wrong")
        );
        return;
      }
      toast.success(isEdit ? "User updated" : "User created");
      setOpen(false);
      if (!isEdit) reset(defaultValues);
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
          reset({
            name: user?.name ?? "",
            email: user?.email ?? "",
            password: "",
            role: user?.role ?? "auctioneer",
            teamId: user?.teamId?._id ? String(user.teamId._id) : "",
          });
        }
      }}
    >
      <DialogTrigger
        render={
          trigger ??
          (isEdit ? (
            <Button variant="ghost" size="icon">
              <Pencil className="size-4" />
            </Button>
          ) : (
            <Button size="sm">
              <Plus className="size-4" />
              Add User
            </Button>
          ))
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "Add User"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this login. Leave password blank to keep the current one."
              : "Create a login for an admin, or an auctioneer who bids on behalf of one team."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">Name</Label>
            <Input id="user-name" placeholder="Jordan Lee" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              placeholder="jordan@auction.local"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-password">
              {isEdit ? "New Password (optional)" : "Password"}
            </Label>
            <Input
              id="user-password"
              type="password"
              placeholder={
                isEdit ? "Leave blank to keep current" : "At least 6 characters"
              }
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={watch("role")}
              disabled={lockRole}
              onValueChange={(v) =>
                setValue("role", v as FormValues["role"], { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue>
                  {(v: string) => ROLE_LABEL[v] ?? "Select role"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lockRole && (
              <p className="text-xs text-muted-foreground">
                You cannot change your own role.
              </p>
            )}
          </div>

          {watch("role") === "auctioneer" && (
            <div className="space-y-2">
              <Label>Represents Team</Label>
              <Select
                value={watch("teamId")}
                onValueChange={(v) => setValue("teamId", v ?? "", { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v: string) => teams.find((t) => t._id === v)?.name ?? "Select team"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.teamId && (
                <p className="text-sm text-destructive">{errors.teamId.message}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
