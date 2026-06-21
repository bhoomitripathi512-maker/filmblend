import { buildRecommendationBundle } from "@/lib/blend/recommendations";
import { enrichFilms } from "@/lib/tmdb/client";
import type {
  BlendResults,
  DirectorStat,
  EnrichedFilm,
  GenreStat,
  LetterboxdFilm,
  ParticipantData,
} from "@/types/blend";

function intersectFilms(a: LetterboxdFilm[], b: LetterboxdFilm[]): LetterboxdFilm[] {
  const bSlugs = new Set(b.map((f) => f.slug));
  return a.filter((f) => bSlugs.has(f.slug));
}

function uniqueFilms(...lists: LetterboxdFilm[][]): LetterboxdFilm[] {
  const map = new Map<string, LetterboxdFilm>();
  for (const list of lists) {
    for (const film of list) {
      map.set(film.slug, film);
    }
  }
  return Array.from(map.values());
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

function topGenres(stats: GenreStat[], n = 5): GenreStat[] {
  return [...stats].sort((a, b) => b.count - a.count).slice(0, n);
}

function sharedTopGenres(a: GenreStat[], b: GenreStat[]): string[] {
  const aTop = new Set(topGenres(a, 8).map((g) => g.genre.toLowerCase()));
  return topGenres(b, 8)
    .filter((g) => aTop.has(g.genre.toLowerCase()))
    .map((g) => g.genre);
}

function genreOverlapScore(a: GenreStat[], b: GenreStat[]): number {
  const shared = sharedTopGenres(a, b);
  if (shared.length === 0) return 0;
  return Math.min(100, Math.round((shared.length / 8) * 100));
}

function sharedDirectors(a: DirectorStat[], b: DirectorStat[]): DirectorStat[] {
  const bMap = new Map(b.map((d) => [d.director.toLowerCase(), d]));
  return a
    .filter((d) => bMap.has(d.director.toLowerCase()))
    .map((d) => {
      const other = bMap.get(d.director.toLowerCase())!;
      return {
        director: d.director,
        count: d.count + other.count,
      };
    })
    .sort((x, y) => y.count - x.count)
    .slice(0, 10);
}

export async function computeBlendResults(
  participants: ParticipantData[],
): Promise<BlendResults> {
  if (participants.length < 2) {
    throw new Error("Need two participants to compute blend");
  }

  const [user1, user2] = participants;
  const commonWatched = intersectFilms(user1.filmsWatched, user2.filmsWatched);
  const commonWatchlist = intersectFilms(
    user1.filmsWatchlist,
    user2.filmsWatchlist,
  );
  const totalUnique = uniqueFilms(
    user1.filmsWatched,
    user2.filmsWatched,
    user1.filmsWatchlist,
    user2.filmsWatchlist,
  ).length;

  const watchedSlugs1 = new Set(user1.filmsWatched.map((f) => f.slug));
  const watchedSlugs2 = new Set(user2.filmsWatched.map((f) => f.slug));
  const watchTogetherRaw = commonWatchlist.filter(
    (f) => !watchedSlugs1.has(f.slug) && !watchedSlugs2.has(f.slug),
  );

  const recommendationBundle = await buildRecommendationBundle(
    user1,
    user2,
    commonWatchlist,
  );

  const [enrichedWatched, enrichedWatchlist, enrichedTogether] = await Promise.all([
    enrichFilms(commonWatched, 24),
    enrichFilms(commonWatchlist, 36),
    enrichFilms(watchTogetherRaw, 36),
  ]);

  return {
    movieMatch: {
      score: computeMatchScore(commonWatched, commonWatchlist, totalUnique),
      commonWatched: enrichedWatched,
      commonWatchlist: enrichedWatchlist,
      totalUniqueFilms: totalUnique,
    },
    genreMatch: {
      sharedTopGenres: recommendationBundle.tasteProfile.sharedGenres.length
        ? recommendationBundle.tasteProfile.sharedGenres
        : sharedTopGenres(user1.genreStats, user2.genreStats),
      user1TopGenres: topGenres(user1.genreStats),
      user2TopGenres: topGenres(user2.genreStats),
      overlapScore: genreOverlapScore(user1.genreStats, user2.genreStats),
      recommendations: recommendationBundle.genreRecommendations,
    },
    watchTogether: enrichedTogether as EnrichedFilm[],
    directorMatch: {
      sharedDirectors: sharedDirectors(
        user1.directorStats,
        user2.directorStats,
      ),
      user1TopDirectors: user1.directorStats.slice(0, 5),
      user2TopDirectors: user2.directorStats.slice(0, 5),
    },
    tasteProfile: recommendationBundle.tasteProfile,
    recommendations: recommendationBundle.recommendations,
  };
}
