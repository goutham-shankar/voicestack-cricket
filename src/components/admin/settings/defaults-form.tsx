"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { settingsSchema, type SettingsInput } from "@/lib/validators/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";

type SettingsDoc = {
  defaultWalletBudget: number;
  defaultMaxSquadSize: number;
  timerSeconds: number;
  // Added with the auction board; older documents will not have them.
  minSquadSize?: number;
  bidIncrement?: number;
  captainsCount?: boolean;
};

export function DefaultsForm({ initialSettings }: { initialSettings: SettingsDoc }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      defaultWalletBudget: initialSettings.defaultWalletBudget,
      defaultMaxSquadSize: initialSettings.defaultMaxSquadSize,
      timerSeconds: initialSettings.timerSeconds,
      minSquadSize:
        initialSettings.minSquadSize ?? initialSettings.defaultMaxSquadSize,
      bidIncrement: initialSettings.bidIncrement ?? 500,
      captainsCount: initialSettings.captainsCount ?? true,
    },
  });

  async function onSubmit(values: SettingsInput) {
    setLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        toast.error("Could not save defaults");
        return;
      }
      toast.success("Defaults saved");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Auction Defaults</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <div className="space-y-2">
            <Label htmlFor="defaultWalletBudget">Default Team Wallet (₹)</Label>
            <Input
              id="defaultWalletBudget"
              type="number"
              {...register("defaultWalletBudget", { valueAsNumber: true })}
            />
            {errors.defaultWalletBudget && (
              <p className="text-sm text-destructive">
                {errors.defaultWalletBudget.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultMaxSquadSize">Default Max Squad Size</Label>
            <Input
              id="defaultMaxSquadSize"
              type="number"
              {...register("defaultMaxSquadSize", { valueAsNumber: true })}
            />
            {errors.defaultMaxSquadSize && (
              <p className="text-sm text-destructive">
                {errors.defaultMaxSquadSize.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="timerSeconds">Lot Timer (seconds)</Label>
            <Input
              id="timerSeconds"
              type="number"
              {...register("timerSeconds", { valueAsNumber: true })}
            />
            {errors.timerSeconds && (
              <p className="text-sm text-destructive">{errors.timerSeconds.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="minSquadSize">Minimum Squad Size</Label>
            <Input
              id="minSquadSize"
              type="number"
              {...register("minSquadSize", { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">
              Every team must reach this. Category minimums are set per category
              below; the first category takes up the slack.
            </p>
            {errors.minSquadSize && (
              <p className="text-sm text-destructive">
                {errors.minSquadSize.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bidIncrement">Bid Increment (₹)</Label>
            <Input
              id="bidIncrement"
              type="number"
              step="any"
              {...register("bidIncrement", { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">
              The least each bid must rise by.
            </p>
            {errors.bidIncrement && (
              <p className="text-sm text-destructive">
                {errors.bidIncrement.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="captainsCount">Captains</Label>
            <label className="flex min-h-9 items-center gap-2 text-sm">
              <input
                id="captainsCount"
                type="checkbox"
                className="size-4"
                {...register("captainsCount")}
              />
              Count toward the squad
            </label>
            <p className="text-xs text-muted-foreground">
              When on, each team&apos;s two captains fill two of its squad slots.
            </p>
            {errors.captainsCount && (
              <p className="text-sm text-destructive">
                {errors.captainsCount.message}
              </p>
            )}
          </div>

          <div className="sm:col-span-3">
            <Button type="submit" disabled={loading || !isDirty}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save Defaults
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
