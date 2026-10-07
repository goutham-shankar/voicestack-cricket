"use client";

import { useCallback, useEffect, useState } from "react";
import { fmt } from "@/lib/auction-engine";
import type { FullAuctionState, TeamSquad } from "@/lib/auction-types";
import { captainLine, teamChipColor } from "@/components/auction/board/board-utils";

/**
 * Every team's purse, and what the engine will let it bid in the round in play.
 * Expanding a row shows the arithmetic behind that maximum, which is the part
 * an auctioneer gets asked about mid-room.
 */
export function PurseTable({ state }: { state: FullAuctionState }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [squads, setSquads] = useState<TeamSquad[] | null>(null);

  const anyExpanded = Object.values(expanded).some(Boolean);

  // Squads are only needed once a row is opened, so they load on demand.
  useEffect(() => {
    if (!anyExpanded || squads) return;
    let cancelled = false;
    fetch("/api/auction/squads", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.squads) setSquads(data.squads);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [anyExpanded, squads]);

  const toggle = useCallback((teamId: string) => {
    setExpanded((prev) => ({ ...prev, [teamId]: !prev[teamId] }));
  }, []);

  const bids = state.auctionState.bids;
  const last = bids.length ? bids[bids.length - 1] : null;
  const isLive = state.auctionState.status === "LIVE";

  const roundId =
    state.auctionState.currentPlayerId?.categoryId?._id ??
    state.auctionState.currentCategoryId;
  const round = state.categories.find((c) => c._id === roundId);
  const minSquad = state.settings.minSquadSize;

  return (
    <div className="tablewrap">
      <table className="purse">
        <thead>
          <tr>
            <th scope="col">Team</th>
            <th scope="col">Purse left</th>
            <th scope="col">Locked</th>
            <th scope="col">Spendable now</th>
            <th scope="col" className="maxcol">
              Max bid{round ? `, ${round.name}` : ""}
            </th>
            <th scope="col">Squad</th>
            {state.categories.map((category) => (
              <th scope="col" key={category._id}>
                {category.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.teams.map((team, index) => {
            const board = team.board;
            const leading = last?.teamId === team._id;
            const limit = board?.limit;
            const out = isLive && !leading && !limit?.ok;
            const open = Boolean(expanded[team._id]);
            const colSpan = 6 + state.categories.length;

            return [
              <tr
                key={team._id}
                className={`${leading ? "leading" : ""}${out ? " out" : ""}`}
                style={{ ["--tc" as string]: teamChipColor(index) }}
              >
                <th scope="row">
                  <button
                    type="button"
                    className="teamcell"
                    aria-expanded={open}
                    onClick={() => toggle(team._id)}
                  >
                    <span className="tn">
                      {team.name}
                      {leading && <span className="tag lead">Leading</span>}
                    </span>
                    <span className="tc">{captainLine(team)}</span>
                  </button>
                </th>

                <td>
                  <span className="big">{fmt(board?.left ?? team.remaining)}</span>
                  {board && board.shortfall > 0 && (
                    <span className="sub short">
                      {fmt(board.shortfall)} short
                    </span>
                  )}
                </td>

                <td>
                  {board && board.locked > 0 ? (
                    <>
                      <span className="big">{fmt(board.locked)}</span>
                      <span className="sub">
                        {board.lockedParts
                          .map((part) => {
                            const name =
                              state.categories.find(
                                (c) => c._id === part.categoryId
                              )?.name ?? "—";
                            return `${name} ${fmt(part.amount)}`;
                          })
                          .join(", ")}
                      </span>
                    </>
                  ) : (
                    <span className="sub">Nothing locked</span>
                  )}
                </td>

                <td>
                  <span className="big">
                    {fmt(board?.spendable ?? team.remaining)}
                  </span>
                </td>

                <td className="maxcol">
                  {limit?.ok ? (
                    <span className="big">{fmt(limit.max)}</span>
                  ) : (
                    <span className="sub">{limit?.reason ?? "—"}</span>
                  )}
                </td>

                <td>
                  <span
                    className={`big${
                      (board?.squad ?? team.squadCount) >= minSquad ? " done" : ""
                    }`}
                  >
                    {board?.squad ?? team.squadCount}
                  </span>
                  <span className="sub">
                    of {minSquad}
                    {team.maxSquadSize != null && `, max ${team.maxSquadSize}`}
                  </span>
                </td>

                {state.categories.map((category) => {
                  const have = board?.count?.[category._id] ?? 0;
                  const need = board?.mand?.[category._id] ?? 0;
                  return (
                    <td key={category._id}>
                      <span className={`big${have >= need ? " done" : ""}`}>
                        {have}
                      </span>
                      <span className="sub">of {need}</span>
                    </td>
                  );
                })}
              </tr>,

              open ? (
                <tr key={`${team._id}-detail`} className="detail">
                  <td colSpan={colSpan}>
                    <TeamDetail
                      state={state}
                      team={team}
                      roundName={round?.name}
                      squad={squads?.find((s) => s._id === team._id) ?? null}
                      squadsLoaded={squads !== null}
                    />
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function TeamDetail({
  state,
  team,
  roundName,
  squad,
  squadsLoaded,
}: {
  state: FullAuctionState;
  team: FullAuctionState["teams"][number];
  roundName?: string;
  squad: TeamSquad | null;
  squadsLoaded: boolean;
}) {
  const board = team.board;
  if (!board) {
    return <p className="note">Add categories to see this team&apos;s bid limit.</p>;
  }

  const limit = board.limit;

  // What is being kept back, so the squad can still be completed at base price.
  const keep = state.categories
    .filter((category) => !board.lockedParts.some((p) => p.categoryId === category._id))
    .map((category) => {
      const stillNeeded = board.rem?.[category._id] ?? 0;
      const fillsThis =
        limit.ok && limit.fills && roundName === category.name ? 1 : 0;
      const n = stillNeeded - fillsThis;
      return n > 0
        ? `${n} ${category.name} at ${fmt(category.defaultBasePrice)}`
        : null;
    })
    .filter(Boolean) as string[];

  return (
    <>
      {limit.ok ? (
        <>
          <p className="calc-title">
            {team.name}&apos;s max bid{roundName ? ` for a ${roundName}` : ""}
          </p>
          <div className="calc">
            <div className="term">
              <span className="sub">Spendable now</span>
              <span className="big">{fmt(board.spendable)}</span>
            </div>
            <span className="op" aria-hidden="true">
              −
            </span>
            <div className="term">
              <span className="sub">Kept back</span>
              <span className="big">{fmt(limit.holdOpen)}</span>
            </div>
            <span className="op" aria-hidden="true">
              =
            </span>
            <div className="term final">
              <span className="sub">Max bid</span>
              <span className="big">{fmt(limit.max)}</span>
            </div>
          </div>
          <p className="note">
            {board.locked > 0 &&
              `Spendable now is the ${fmt(board.left)} purse left minus ${fmt(
                board.locked
              )} locked for rounds that have not opened. `}
            {keep.length
              ? `Kept back so the squad can still be completed: ${keep.join(", ")}.`
              : "Nothing has to be kept back."}
          </p>
        </>
      ) : (
        <p className="note">{limit.reason}</p>
      )}

      {squad && squad.players.length > 0 ? (
        <ul className="squadlist">
          {squad.players.map((player) => (
            <li key={player._id}>
              <span>
                {player.name} <span className="tag">{player.category ?? "—"}</span>
              </span>
              <span>{fmt(player.price)}</span>
            </li>
          ))}
        </ul>
      ) : squadsLoaded ? (
        <p className="note">No players bought yet.</p>
      ) : (
        <p className="note">Loading squad…</p>
      )}
    </>
  );
}
