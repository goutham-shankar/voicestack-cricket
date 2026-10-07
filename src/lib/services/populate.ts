import type { PlayerCategoryDoc } from "@/models/PlayerCategory";
import type { PlayerTagDoc } from "@/models/PlayerTag";
import type { TeamDoc } from "@/models/Team";
import type { PlayerDoc } from "@/models/Player";
import { getCategories, getTags, getTeams } from "@/lib/services/catalog";

/**
 * References are resolved here, in memory, rather than with `$lookup` — the
 * replacement for Mongoose's `.populate()`. The collections are small and
 * already loaded for other reasons, so joining in the database would cost a
 * round trip to repeat work this process has done. The output keeps the
 * original field names
 * (`categoryId`, `tagIds`, `soldToTeamId`) holding whole documents, so every
 * client component that already read `player.categoryId.name` still works.
 */
export type PopulatedPlayer = Omit<PlayerDoc, "categoryId" | "tagIds"> & {
  categoryId: PlayerCategoryDoc | null;
  tagIds: PlayerTagDoc[];
};

export type PopulatedPlayerWithTeam = Omit<PopulatedPlayer, "soldToTeamId"> & {
  soldToTeamId: TeamDoc | null;
};

type RefMaps = {
  categories: Map<string, PlayerCategoryDoc>;
  tags: Map<string, PlayerTagDoc>;
  teams: Map<string, TeamDoc>;
};

/**
 * One read per referenced collection, however many players are being decorated
 * — and the reads are request-memoised, so a page that already fetched
 * categories for its own filters does not fetch them again here.
 */
export async function loadRefMaps(options?: { teams?: boolean }): Promise<RefMaps> {
  const [categories, tags, teams] = await Promise.all([
    getCategories(),
    getTags(),
    options?.teams ? getTeams() : Promise.resolve([]),
  ]);

  return {
    categories: new Map(categories.map((c) => [c._id, c])),
    tags: new Map(tags.map((t) => [t._id, t])),
    teams: new Map(teams.map((t) => [t._id, t])),
  };
}

export function decoratePlayer(player: PlayerDoc, refs: RefMaps): PopulatedPlayer {
  return {
    ...player,
    categoryId: refs.categories.get(player.categoryId) ?? null,
    tagIds: player.tagIds
      .map((id) => refs.tags.get(id))
      .filter((tag): tag is PlayerTagDoc => Boolean(tag)),
  };
}

export function decoratePlayerWithTeam(
  player: PlayerDoc,
  refs: RefMaps
): PopulatedPlayerWithTeam {
  return {
    ...decoratePlayer(player, refs),
    soldToTeamId: player.soldToTeamId
      ? (refs.teams.get(player.soldToTeamId) ?? null)
      : null,
  };
}

export async function populatePlayers(players: PlayerDoc[]) {
  const refs = await loadRefMaps();
  return players.map((player) => decoratePlayer(player, refs));
}

export async function populatePlayersWithTeam(players: PlayerDoc[]) {
  const refs = await loadRefMaps({ teams: true });
  return players.map((player) => decoratePlayerWithTeam(player, refs));
}

export async function populatePlayer(player: PlayerDoc) {
  return (await populatePlayers([player]))[0];
}
