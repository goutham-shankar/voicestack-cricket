"use client";

import { SegmentError } from "@/components/segment-error";

/**
 * Root segment boundary: catches anything below `app/layout.tsx` that has no
 * closer boundary of its own. Without one, a single client component that
 * throws takes the whole document down to Next's built-in "This page couldn't
 * load" screen, which names nothing and offers only a reload.
 */
export default function RootError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SegmentError {...props} where="root" />;
}
