"use client";

import { fmt, shortReason, type BidRefusalCode } from "@/lib/auction-engine";
import type { BidEntryDTO, TeamSummary } from "@/lib/auction-types";
import { teamColor } from "@/components/auction/board/board-utils";

/**
 * One paddle per team. A paddle is live only when the engine says the team may
 * bid and the pending amount sits within its limit — the same `bidLimit` the
 * server enforces, so the UI never offers a bid that would be refused.
 */
export function TeamPaddles({
  teams,
  bids,
  nextBid,
  minNext,
  busy,
  onBid,
}: {
  teams: TeamSummary[];
  bids: BidEntryDTO[];
  nextBid: number;
  minNext: number;
  busy: boolean;
  onBid: (teamId: string) => void;
}) {
  const last = bids.length ? bids[bids.length - 1] : null;

  return (
    <div className="paddles">
      {teams.map((team, index) => {
        const leading = last?.teamId === team._id;
        const limit = team.board?.limit;

        let sub: string;
        let enabled = false;
        if (leading) {
          sub = "Leading";
        } else if (!limit) {
          sub = "No rounds set up";
        } else if (!limit.ok) {
          sub = shortReason(limit.code as BidRefusalCode);
        } else {
          sub = `Max ₹${fmt(limit.max)}`;
          enabled = nextBid >= minNext - 1e-9 && nextBid <= limit.max + 1e-9;
        }

        const cant = !leading && !enabled;

        return (
          <button
            key={team._id}
            type="button"
            className={`paddle${leading ? " leading" : ""}${cant ? " cant" : ""}`}
            style={{ ["--pc" as string]: teamColor(index) }}
            disabled={!enabled || busy}
            onClick={() => onBid(team._id)}
            aria-label={`${team.name}, ${sub}`}
          >
            <span className="pn" aria-hidden="true">
              {index + 1}
            </span>
            <span className="pt">{team.name}</span>
            <span className="ps">{sub}</span>
          </button>
        );
      })}
    </div>
  );
}
