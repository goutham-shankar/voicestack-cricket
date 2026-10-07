import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shown the instant a team tab is clicked, while its server component fetches.
 *
 * This does more than look busy. Next only prefetches a dynamic route up to its
 * nearest loading boundary, so without this file a team tab prefetched nothing
 * and the click blocked on a full server render — session, team lookup and
 * queries — with the old page frozen on screen the whole time. With it the
 * shell paints immediately and the data streams in behind. The topbar lives in
 * the layout and stays put, so only this pane swaps.
 */
export default function TeamLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-baseline justify-between">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, row) => (
          <div key={row} className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
