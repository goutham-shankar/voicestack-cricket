"use client";

import { SegmentError } from "@/components/segment-error";

/** Keeps the auctioneer chrome (sidebar, header) around a failed page. */
export default function AuctioneerError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SegmentError {...props} where="auctioneer" />;
}
