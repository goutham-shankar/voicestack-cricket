"use client";

import { fmt } from "@/lib/auction-engine";
import type { LastResultDTO } from "@/lib/auction-types";

/**
 * The rotated SOLD / UNSOLD stamp for the lot that just settled. The parent
 * keys this on `result.key`, so it remounts — and therefore animates — exactly
 * once per result.
 */
export function ResultStamp({
  result,
  color,
}: {
  result: LastResultDTO;
  color: string;
}) {
  const sold = result.kind === "SOLD";
  return (
    <div className="result">
      <div className={`stamp anim${sold ? "" : " unsold"}`}>
        {sold ? "SOLD" : "UNSOLD"}
      </div>
      <div>
        <span className="lbl">Last player</span>
        <div className="rname">{result.playerName}</div>
        {sold && (
          <div className="rto" style={{ ["--pc" as string]: color }}>
            <span className="dot" aria-hidden="true" />
            {result.teamName} for ₹{fmt(result.amount)}
          </div>
        )}
      </div>
    </div>
  );
}
