import { cache } from "react";
import { Players } from "@/models/Player";
import { Teams } from "@/models/Team";
import { PlayerCategories } from "@/models/PlayerCategory";
import { PlayerTags } from "@/models/PlayerTag";

/**
 * Read-only catalogue reads, memoised for the lifetime of one request.
 *
 * Admin pages and the routes that feed them ask for the same few collections
 * several times over — the players page wants categories and tags for its
 * filters, and resolving each player's references wants them again. React's
 * `cache` collapses those into one Firestore read per request.
 *
 * Deliberately not used by the auction service: that reads, writes and then
 * re-reads within a single request, and must never see a memoised copy of
 * state it just changed.
 */
export const getCategories = cache(() =>
  PlayerCategories.find(undefined, { sort: { order: 1, name: 1 } })
);

export const getTags = cache(() => PlayerTags.find(undefined, { sort: { name: 1 } }));

export const getTeams = cache(() => Teams.find(undefined, { sort: { name: 1 } }));

export const getAllPlayers = cache(() => Players.find());
