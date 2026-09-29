import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: "default" | "gold" | "sold" | "unsold" | "live";
  className?: string;
}) {
  const accentClass = {
    default: "text-foreground",
    gold: "text-primary",
    sold: "text-sold",
    unsold: "text-unsold-foreground",
    live: "text-live",
  }[accent ?? "default"];

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon && <Icon className={cn("size-4", accentClass)} />}
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tabular-money", accentClass)}>
        {value}
      </p>
    </div>
  );
}
