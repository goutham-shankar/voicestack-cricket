"use client";

import { SegmentError } from "@/components/segment-error";

/** Keeps the team chrome (sidebar, header) around a failed page. */
export default function TeamError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SegmentError {...props} where="team" />;
}
