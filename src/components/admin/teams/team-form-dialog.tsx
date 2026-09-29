"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { teamSchema, type TeamInput } from "@/lib/validators/team";
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
import { Separator } from "@/components/ui/separator";
import { ImageUpload } from "@/components/admin/image-upload";
import { Loader2, Plus } from "lucide-react";

export type TeamRecord = {
  _id: string;
  name: string;
  logoUrl: string | null;
  initialBudget: number;
  maxSquadSize: number;
  loginEmail?: string | null;
};

export function TeamFormDialog({
  team,
  onSaved,
  trigger,
}: {
  team?: TeamRecord;
  onSaved: () => void;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(team);

  const defaultValues: TeamInput = {
    name: team?.name ?? "",
    logoUrl: team?.logoUrl ?? null,
    initialBudget: team?.initialBudget ?? 100000,
    maxSquadSize: team?.maxSquadSize ?? 12,
    loginEmail: "",
    loginPassword: "",
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TeamInput>({
    resolver: zodResolver(teamSchema),
    defaultValues,
  });

  const logoUrl = watch("logoUrl");

  async function onSubmit(values: TeamInput) {
    setLoading(true);
    try {
      const payload = isEdit
        ? { name: values.name, logoUrl: values.logoUrl, initialBudget: values.initialBudget, maxSquadSize: values.maxSquadSize }
        : values;

      const res = await fetch(isEdit ? `/api/teams/${team!._id}` : "/api/teams", {
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
      toast.success(isEdit ? "Team updated" : "Team created");
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
        if (next) reset(defaultValues);
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus className="size-4" />
              Add Team
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Team" : "Add Team"}</DialogTitle>
          <DialogDescription>
            Set the team&apos;s identity, wallet budget and squad limit.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Logo</Label>
            <ImageUpload
              value={logoUrl}
              onChange={(url) => setValue("logoUrl", url, { shouldDirty: true })}
              scope="teams"
              fallback={(team?.name ?? "T").slice(0, 2).toUpperCase()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-name">Team Name</Label>
            <Input id="team-name" placeholder="Team Titans" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="team-budget">Wallet Budget (₹)</Label>
              <Input
                id="team-budget"
                type="number"
                {...register("initialBudget", { valueAsNumber: true })}
              />
              {errors.initialBudget && (
                <p className="text-sm text-destructive">
                  {errors.initialBudget.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-squad">Max Squad Size</Label>
              <Input
                id="team-squad"
                type="number"
                {...register("maxSquadSize", { valueAsNumber: true })}
              />
              {errors.maxSquadSize && (
                <p className="text-sm text-destructive">
                  {errors.maxSquadSize.message}
                </p>
              )}
            </div>
          </div>

          {isEdit ? (
            <p className="text-xs text-muted-foreground">
              Login:{" "}
              {team?.loginEmail ? (
                <span className="font-medium text-foreground">{team.loginEmail}</span>
              ) : (
                "not provisioned"
              )}
            </p>
          ) : (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-sm font-medium">Team Login (optional)</p>
                <p className="text-xs text-muted-foreground">
                  Create sign-in credentials so this team can access their dashboard.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-login-email">Login Email</Label>
                <Input
                  id="team-login-email"
                  type="email"
                  placeholder="titans@auction.local"
                  {...register("loginEmail")}
                />
                {errors.loginEmail && (
                  <p className="text-sm text-destructive">
                    {errors.loginEmail.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-login-password">Login Password</Label>
                <Input
                  id="team-login-password"
                  type="password"
                  placeholder="At least 6 characters"
                  {...register("loginPassword")}
                />
                {errors.loginPassword && (
                  <p className="text-sm text-destructive">
                    {errors.loginPassword.message}
                  </p>
                )}
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
