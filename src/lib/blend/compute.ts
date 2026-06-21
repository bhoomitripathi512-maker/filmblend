import { buildRecommendationBundle } from "@/lib/blend/recommendations";
import { intersectFilmsRobust, uniqueFilms } from "@/lib/blend/matching";
import {
  buildTasteProfile,
  genreOverlapFromTaste,
  weightedToGenreStats,
} from "@/lib/blend/taste";
import { enrichFilmsBatch } from "@/lib/tmdb/client";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  BlendResults,
  DirectorStat,
  EnrichedFilm,
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

function collectSeenTmdbIds(...lists: EnrichedFilm[][]): Set<number> {
  const ids = new Set<number>();
  for (const list of lists) {
    for (const film of list) {
      if (film.tmdbId) ids.add(film.tmdbId);
    }
  }
  return ids;
}

function participantSeenTmdbIds(
  watched: EnrichedFilm[],
  watchlist: EnrichedFilm[],
): number[] {
  return Array.from(collectSeenTmdbIds(watched, watchlist));
}

async function persistEnrichedParticipants(
  options: ComputeBlendOptions,
  enriched: {
    user1Watched: EnrichedFilm[];
    user1Watchlist: EnrichedFilm[];
    user2Watched: EnrichedFilm[];
    user2Watchlist: EnrichedFilm[];
  },
): Promise<void> {
  if (!options.blendId || !options.participantRowIds?.length) return;

  const supabase = createAdminClient();
  const updates = [
    {
      slot: 1 as const,
      films_watched: enriched.user1Watched,
      films_watchlist: enriched.user1Watchlist,
      seen_tmdb_ids: participantSeenTmdbIds(
        enriched.user1Watched,
        enriched.user1Watchlist,
      ),
    },
    {
      slot: 2 as const,
      films_watched: enriched.user2Watched,
      films_watchlist: enriched.user2Watchlist,
      seen_tmdb_ids: participantSeenTmdbIds(
        enriched.user2Watched,
        enriched.user2Watchlist,
      ),
    },
  ];

  await Promise.all(
    updates.map(async (update) => {
      const row = options.participantRowIds!.find((p) => p.slot === update.slot);
      if (!row) return;

      await supabase
        .from("blend_participants")
        .update({
          films_watched: update.films_watched,
          films_watchlist: update.films_watchlist,
          seen_tmdb_ids: update.seen_tmdb_ids,
        })
        .eq("id", row.id);
    }),
  );
}

export async function computeBlendResults(
  participants: ParticipantData[],
  options: ComputeBlendOptions = {},
): Promise<BlendResults> {
  if (participants.length < 2) {
    throw new Error("Need two participants to compute blend");
  }

  const [user1, user2] = participants;

  const [
    enrichedUser1Watched,
    enrichedUser1Watchlist,
    enrichedUser2Watched,
    enrichedUser2Watchlist,
  ] = await Promise.all([
    enrichFilmsBatch(user1.filmsWatched),
    enrichFilmsBatch(user1.filmsWatchlist),
    enrichFilmsBatch(user2.filmsWatched),
    enrichFilmsBatch(user2.filmsWatchlist),
  ]);

  const seenTmdbIds = collectSeenTmdbIds(
    enrichedUser1Watched,
    enrichedUser1Watchlist,
    enrichedUser2Watched,
    enrichedUser2Watchlist,
  );

  await persistEnrichedParticipants(options, {
    user1Watched: enrichedUser1Watched,
    user1Watchlist: enrichedUser1Watchlist,
    user2Watched: enrichedUser2Watched,
    user2Watchlist: enrichedUser2Watchlist,
  });

  const enrichedUser1 = {
    ...user1,
    filmsWatched: enrichedUser1Watched,
    filmsWatchlist: enrichedUser1Watchlist,
  };
  const enrichedUser2 = {
    ...user2,
    filmsWatched: enrichedUser2Watched,
    filmsWatchlist: enrichedUser2Watchlist,
  };

  const commonWatchlistRaw = intersectFilmsRobust(
    enrichedUser1.filmsWatchlist,
    enrichedUser2.filmsWatchlist,
    enrichedUser1.filmsWatchlist,
    enrichedUser2.filmsWatchlist,
  );

  const commonWatchedRaw = intersectFilmsRobust(
    enrichedUser1.filmsWatched,
    enrichedUser2.filmsWatched,
    enrichedUser1.filmsWatched,
    enrichedUser2.filmsWatched,
  );

  const totalUnique = uniqueFilms(
    enrichedUser1.filmsWatched,
    enrichedUser2.filmsWatched,
    enrichedUser1.filmsWatchlist,
    enrichedUser2.filmsWatchlist,
  ).length;

  const tasteProfile = await buildTasteProfile(enrichedUser1, enrichedUser2, {
    user1: enrichedUser1Watched,
    user2: enrichedUser2Watched,
  });

  const recommendations = await buildRecommendationBundle(
    enrichedUser1,
    enrichedUser2,
    tasteProfile,
    seenTmdbIds,
  );

  return {
    movieMatch: {
      score: computeMatchScore(
        commonWatchedRaw,
        commonWatchlistRaw,
        totalUnique,
      ),
      commonWatched: commonWatchedRaw,
      commonWatchlist: commonWatchlistRaw,
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
  };
}
