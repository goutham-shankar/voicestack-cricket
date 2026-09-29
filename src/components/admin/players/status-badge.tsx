import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  LIVE: "bg-live/15 text-live",
  SOLD: "bg-sold/15 text-sold",
  UNSOLD: "bg-unsold/40 text-unsold-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("border-0 font-semibold", STATUS_STYLES[status])}>
      {status}
    </Badge>
  );
}
