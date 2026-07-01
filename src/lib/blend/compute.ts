import { buildRecommendationBundle } from "@/lib/blend/recommendations";
import { intersectFilmsRobust, uniqueFilms } from "@/lib/blend/matching";
import {
  buildTasteProfile,
  genreOverlapFromTaste,
  weightedToGenreStats,
} from "@/lib/blend/taste";
import { enrichFilmsBatch, resolveExcludeTmdbIds } from "@/lib/tmdb/client";
import type {
  BlendResults,
  DirectorStat,
  LetterboxdFilm,
  ParticipantData,
} from "@/types/blend";

export interface ComputeBlendOptions {
  blendId?: string;
  participantRowIds?: { slot: 1 | 2; id: string }[];
}

function computeMatchScore(
  commonWatched: LetterboxdFilm[],
  commonWatchlist: LetterboxdFilm[],
  totalUnique: number,
): number {
  if (totalUnique === 0) return 0;
  const overlap = commonWatched.length * 2 + commonWatchlist.length;
  return Math.min(100, Math.round((overlap / totalUnique) * 100));
}

function sharedDirectorsFromTaste(
  user1Directors: { name: string; count: number }[],
  user2Directors: { name: string; count: number }[],
): DirectorStat[] {
  const bMap = new Map(
    user2Directors.map((d) => [d.name.toLowerCase(), d]),
  );

  return user1Directors
    .filter((d) => bMap.has(d.name.toLowerCase()))
    .map((d) => {
      const other = bMap.get(d.name.toLowerCase())!;
      return {
        director: d.name,
        count: d.count + other.count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export const RECOMMENDATIONS_ALGO_VERSION = 2;

export async function computeBlendResults(
  participants: ParticipantData[],
  options: ComputeBlendOptions = {},
): Promise<BlendResults> {
  void options;

  if (participants.length < 2) {
    throw new Error("Need two participants to compute blend");
  }

  const [user1, user2] = participants;

  const commonWatchlistRaw = intersectFilmsRobust(
    user1.filmsWatchlist,
    user2.filmsWatchlist,
  );

  const commonWatchedRaw = intersectFilmsRobust(
    user1.filmsWatched,
    user2.filmsWatched,
  );

  const totalUnique = uniqueFilms(
    user1.filmsWatched,
    user2.filmsWatched,
    user1.filmsWatchlist,
    user2.filmsWatchlist,
  ).length;

  const [enrichedWatchedSample1, enrichedWatchedSample2] = await Promise.all([
    enrichFilmsBatch(user1.filmsWatched.slice(0, 35)),
    enrichFilmsBatch(user2.filmsWatched.slice(0, 35)),
  ]);

  const [commonWatched, commonWatchlist, tasteProfile] = await Promise.all([
    enrichFilmsBatch(commonWatchedRaw.slice(0, 40)),
    enrichFilmsBatch(commonWatchlistRaw.slice(0, 25)),
    buildTasteProfile(user1, user2, {
      user1: enrichedWatchedSample1,
      user2: enrichedWatchedSample2,
    }),
  ]);

  const seenFilms = uniqueFilms(
    user1.filmsWatched,
    user1.filmsWatchlist,
    user2.filmsWatched,
    user2.filmsWatchlist,
  );
  const seenTmdbIds = new Set(await resolveExcludeTmdbIds(seenFilms, 50));

  const recommendations = await buildRecommendationBundle(
    user1,
    user2,
    tasteProfile,
    seenTmdbIds,
    seenFilms,
    options.blendId ?? "",
  );

  return {
    movieMatch: {
      score: computeMatchScore(
        commonWatchedRaw,
        commonWatchlistRaw,
        totalUnique,
      ),
      commonWatched,
      commonWatchlist,
      totalUniqueFilms: totalUnique,
    },
    genreMatch: {
      sharedTopGenres: tasteProfile.sharedGenresRanked
        .slice(0, 8)
        .map((g) => g.name),
      user1TopGenres: weightedToGenreStats(tasteProfile.user1TopGenres),
      user2TopGenres: weightedToGenreStats(tasteProfile.user2TopGenres),
      overlapScore: genreOverlapFromTaste(tasteProfile),
    },
    directorMatch: {
      sharedDirectors: sharedDirectorsFromTaste(
        tasteProfile.user1TopDirectors.map((d) => ({
          name: d.name,
          count: d.count,
        })),
        tasteProfile.user2TopDirectors.map((d) => ({
          name: d.name,
          count: d.count,
        })),
      ),
      user1TopDirectors: tasteProfile.user1TopDirectors.slice(0, 5).map(
        (d) => ({ director: d.name, count: d.count }),
      ),
      user2TopDirectors: tasteProfile.user2TopDirectors.slice(0, 5).map(
        (d) => ({ director: d.name, count: d.count }),
      ),
    },
    tasteProfile,
    recommendations,
    algoVersion: RECOMMENDATIONS_ALGO_VERSION,
  };
}
