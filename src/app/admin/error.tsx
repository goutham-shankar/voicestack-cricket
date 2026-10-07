"use client";

import { SegmentError } from "@/components/segment-error";

/** Keeps the admin chrome (sidebar, header) around a failed page. */
export default function AdminError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SegmentError {...props} where="admin" />;
}
