import type { TeamSummary } from "@/lib/auction-types";

/** The board cycles through eight team colours, as the original does. */
export function teamColor(index: number) {
  return `var(--p${Math.max(0, index) % 8})`;
}

export function teamChipColor(index: number) {
  return `var(--t${Math.max(0, index) % 8})`;
}

export function captainLine(team: Pick<TeamSummary, "captainMale" | "captainFemale">) {
  const names = [team.captainMale, team.captainFemale].filter(Boolean);
  return names.length ? names.join(" and ") : "Captains not set";
}
