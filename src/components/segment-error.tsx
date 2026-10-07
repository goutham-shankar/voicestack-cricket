"use client";

import { useEffect } from "react";

/**
 * The body shared by every segment-level `error.tsx`.
 *
 * Kept in one place so the root boundary and the per-area ones stay identical;
 * which boundary catches a throw only decides how much chrome survives around
 * it, not what the operator sees.
 */
export function SegmentError({
  error,
  reset,
  where,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Named in the console line, so logs say which boundary fired. */
  where: string;
}) {
  useEffect(() => {
    // Goes to the browser console and, in production, to Vercel's client logs,
    // so an intermittent failure leaves a trail instead of vanishing on reload.
    console.error(`[${where}] error boundary caught:`, error);
  }, [error, where]);

  return (
    <div className="mx-auto max-w-xl space-y-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">
        Something on this page broke
      </h1>
      <p className="text-sm text-muted-foreground">
        The rest of the app is still running. Try again — if it keeps happening,
        the details below are what to report.
      </p>

      <pre className="overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
        {error.message || "Unknown error"}
        {error.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium"
        >
          Reload the page
        </button>
      </div>
    </div>
  );
}
