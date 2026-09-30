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
  minReservePerSlot?: number;
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
      minReservePerSlot: initialSettings.minReservePerSlot ?? 1000,
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
            <Label htmlFor="minReservePerSlot">Min Reserve / Remaining Slot (₹)</Label>
            <Input
              id="minReservePerSlot"
              type="number"
              {...register("minReservePerSlot", { valueAsNumber: true })}
            />
            {errors.minReservePerSlot && (
              <p className="text-sm text-destructive">
                {errors.minReservePerSlot.message}
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
