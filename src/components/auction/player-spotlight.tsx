import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Gavel } from "lucide-react";
import type { PlayerRef } from "@/lib/auction-types";

export function PlayerSpotlight({ player }: { player: PlayerRef | null }) {
  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
        <Gavel className="size-10" />
        <p className="text-sm">No player is currently live.</p>
      </div>
    );
  }

  const basePrice = player.basePriceOverride ?? player.categoryId?.defaultBasePrice ?? 0;

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <Avatar className="size-32 rounded-2xl shadow-lg ring-2 ring-primary/30 sm:size-40">
        {player.avatarUrl && <AvatarImage src={player.avatarUrl} alt="" />}
        <AvatarFallback className="rounded-2xl bg-secondary text-3xl">
          {player.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {player.name}
        </h2>
        <p className="text-sm text-muted-foreground">{player.role}</p>
      </div>

      <Badge variant="secondary" className="text-xs font-medium">
        {player.categoryId?.name ?? "Uncategorized"} Player
      </Badge>

      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Base Price
        </p>
        <p className="text-xl font-bold tabular-money text-primary">
          ₹{basePrice.toLocaleString("en-IN")}
        </p>
      </div>

      {player.tagIds.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {player.tagIds.map((tag) => (
            <Badge
              key={tag._id}
              className="border-0 text-[10px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: `${tag.color}26`, color: tag.color }}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
