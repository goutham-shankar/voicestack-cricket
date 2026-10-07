import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shown the instant an admin tab is clicked, while its server component
 * fetches. Without it Next holds the old page until the new one is ready, so a
 * slow query reads as an unresponsive app. The sidebar and header live in the
 * layout and stay put, so only this pane swaps.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-full max-w-xs" />
            <Skeleton className="h-9 w-28" />
          </div>
          {Array.from({ length: 8 }).map((_, row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-xl" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="hidden h-4 w-20 md:block" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
