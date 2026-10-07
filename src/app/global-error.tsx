"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary, for throws in the root layout itself — the only case
 * `app/error.tsx` cannot catch. It replaces the document, so it ships its own
 * <html>/<body> and inline styles rather than relying on the app's CSS having
 * loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0b0b0c",
          color: "#f4f4f5",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "32rem", width: "100%" }}>
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 .5rem" }}>
            The app failed to start
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: ".875rem", margin: "0 0 1rem" }}>
            This is the root layout failing, so nothing else could render.
          </p>
          <pre
            style={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 6,
              padding: 12,
              fontSize: ".75rem",
              overflow: "auto",
            }}
          >
            {error.message || "Unknown error"}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 12,
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: "#f4f4f5",
              color: "#0b0b0c",
              fontSize: ".875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
