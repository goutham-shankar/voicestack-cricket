"use client";

import { useState } from "react";
import { fmt } from "@/lib/auction-engine";
import type { FullAuctionState } from "@/lib/auction-types";
import { teamChipColor } from "@/components/auction/board/board-utils";

/** Who is waiting in this round, who went unsold, and what just sold. */
export function PlayerQueue({
  state,
  busy,
  onBringUp,
  onRequeue,
}: {
  state: FullAuctionState;
  busy: boolean;
  onBringUp: (playerId: string) => void;
  onRequeue: (playerId: string) => void;
}) {
  const [filter, setFilter] = useState("");

  const round = state.auctionState.currentCategoryId;
  const roundName =
    state.categories.find((c) => c._id === round)?.name ?? "this round";
  const isLive = state.auctionState.status === "LIVE";

  const waiting = state.pendingPlayers.filter(
    (player) =>
      player.status === "PENDING" &&
      (!round || player.categoryId?._id === round)
  );
  const unsold = state.pendingPlayers.filter((p) => p.status === "UNSOLD");

  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? waiting.filter((p) => p.name.toLowerCase().includes(needle))
    : waiting;

  const teamIndex = new Map(state.teams.map((team, i) => [team.name, i]));

  return (
    <>
      <h2>
        Up next <span className="count">{waiting.length} waiting</span>
      </h2>

      <label className="sr-only" htmlFor="vpl-qfilter">
        Find a player
      </label>
      <input
        id="vpl-qfilter"
        className="field"
        type="search"
        placeholder="Find a player"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />

      <ul className="qlist">
        {shown.length === 0 ? (
          <li className="empty">
            {needle
              ? `No player matches “${filter}”`
              : `Nobody is waiting in ${roundName}`}
          </li>
        ) : (
          shown.map((player) => (
            <li key={player._id}>
              <button
                type="button"
                className="qbtn"
                disabled={isLive || busy}
                onClick={() => onBringUp(player._id)}
              >
                <span>{player.name}</span>
                <span className="tag">{player.role}</span>
              </button>
            </li>
          ))
        )}
      </ul>

      {unsold.length > 0 && (
        <>
          <h3>
            Unsold <span className="count">{unsold.length}</span>
          </h3>
          <ul className="qlist short">
            {unsold.map((player) => (
              <li key={player._id} className="qrow">
                <span>
                  {player.name}{" "}
                  <span className="tag">{player.categoryId?.name ?? "—"}</span>
                </span>
                <button
                  type="button"
                  className="btn small"
                  disabled={busy}
                  onClick={() => onRequeue(player._id)}
                >
                  Bring back
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {state.recentSales.length > 0 && (
        <>
          <h3>Recently sold</h3>
          <ul className="recent">
            {state.recentSales.slice(0, 6).map((sale) => (
              <li key={sale._id}>
                <span className="who">
                  <span
                    className="chip"
                    style={{
                      ["--tc" as string]: teamChipColor(
                        teamIndex.get(sale.teamName) ?? 0
                      ),
                    }}
                  />
                  {sale.playerName}
                </span>
                <span>
                  {sale.teamName}, ₹{fmt(sale.price)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
