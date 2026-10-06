import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RecentSale } from "@/lib/auction-types";

export function RecentSalesList({ sales }: { sales: RecentSale[] }) {
  if (sales.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No players sold yet.
      </p>
    );
  }

  return (
    <ScrollArea className="h-56">
      <div className="space-y-1 pr-3">
        {sales.map((sale, i) => (
          <div
            key={sale._id}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm"
            style={
              i === 0
                ? { backgroundColor: "color-mix(in oklch, var(--sold) 10%, transparent)" }
                : undefined
            }
          >
            <Avatar className="size-8 shrink-0 rounded-lg">
              {sale.avatarUrl && <AvatarImage src={sale.avatarUrl} alt="" />}
              <AvatarFallback className="rounded-lg bg-secondary text-[10px]">
                {sale.playerName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{sale.playerName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {sale.teamName}
              </p>
            </div>
            <span className="tabular-money shrink-0 font-semibold text-sold">
              {sale.price.toLocaleString("en-IN")}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
