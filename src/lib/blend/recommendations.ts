import {
  discoverMovies,
  enrichFilm,
  enrichFilms,
  getMovieRecommendations,
  isTmdbConfigured,
  mapGenreToTmdbId,
  searchPersonId,
  tmdbResultToEnriched,
} from "@/lib/tmdb/client";
import type {
  EnrichedFilm,
  GenreRecommendationGroup,
  LetterboxdFilm,
  ParticipantData,
  RatedFilm,
  RecommendedFilm,
  TasteProfile,
} from "@/types/blend";

const HIGH_RATING_THRESHOLD = 4;

interface ScoredCandidate {
  tmdbId: number;
  title: string;
  year?: number;
  posterPath?: string | null;
  score: number;
  reasons: Set<string>;
}

function normalizeGenre(genre: string): string {
  return genre.toLowerCase().trim();
}

function intersectRatedFilms(
  a: RatedFilm[],
  b: RatedFilm[],
  minRating = HIGH_RATING_THRESHOLD,
): RatedFilm[] {
  const bMap = new Map(
    b.filter((f) => f.rating >= minRating).map((f) => [f.slug, f]),
  );

  return a
    .filter((f) => f.rating >= minRating && bMap.has(f.slug))
    .map((f) => {
      const other = bMap.get(f.slug)!;
      return {
        ...f,
        rating: Math.min(f.rating, other.rating),
      };
    })
    .sort((x, y) => y.rating - x.rating);
}

function sharedGenresByWeight(
  user1: ParticipantData,
  user2: ParticipantData,
  limit = 6,
): string[] {
  const bMap = new Map(
    user2.genreStats.map((g) => [normalizeGenre(g.genre), g.count]),
  );

  const combined = user1.genreStats
    .map((g) => {
      const otherCount = bMap.get(normalizeGenre(g.genre)) ?? 0;
      return {
        genre: g.genre,
        combined: g.count + otherCount,
      };
    })
    .filter((g) => otherCountExists(g.genre, bMap))
    .sort((a, b) => b.combined - a.combined);

  return combined.slice(0, limit).map((g) => g.genre);
}

function otherCountExists(
  genre: string,
  bMap: Map<string, number>,
): boolean {
  return (bMap.get(normalizeGenre(genre)) ?? 0) > 0;
}

function sharedDirectorNames(
  user1: ParticipantData,
  user2: ParticipantData,
): string[] {
  const bSet = new Set(
    user2.directorStats.map((d) => d.director.toLowerCase()),
  );
  return user1.directorStats
    .filter((d) => bSet.has(d.director.toLowerCase()))
    .map((d) => d.director)
    .slice(0, 8);
}

function buildExcludeTmdbIds(
  user1: ParticipantData,
  user2: ParticipantData,
  enrichedWatched: EnrichedFilm[],
): Set<number> {
  const ids = new Set<number>();
  for (const film of enrichedWatched) {
    if (film.tmdbId) ids.add(film.tmdbId);
  }
  return ids;
}

function addCandidate(
  map: Map<number, ScoredCandidate>,
  candidate: Omit<ScoredCandidate, "reasons"> & { reason: string },
) {
  const existing = map.get(candidate.tmdbId);
  if (existing) {
    existing.score += candidate.score;
    existing.reasons.add(candidate.reason);
    return;
  }

  map.set(candidate.tmdbId, {
    tmdbId: candidate.tmdbId,
    title: candidate.title,
    year: candidate.year,
    posterPath: candidate.posterPath,
    score: candidate.score,
    reasons: new Set([candidate.reason]),
  });
}

async function buildGenreRecommendations(
  sharedGenres: string[],
  excludeIds: number[],
): Promise<GenreRecommendationGroup[]> {
  if (!isTmdbConfigured()) return [];

  const groups: GenreRecommendationGroup[] = [];

  for (const genre of sharedGenres.slice(0, 4)) {
    const genreId = mapGenreToTmdbId(genre);
    if (!genreId) continue;

    const results = await discoverMovies({
      genreIds: [genreId],
      excludeIds,
      page: 1,
    });

    const films: RecommendedFilm[] = results.slice(0, 8).map((r) => ({
      ...tmdbResultToEnriched(r),
      reason: `Popular ${genre} pick — a genre you both love`,
      matchScore: 70,
    }));

    if (films.length > 0) {
      groups.push({ genre, films });
    }
  }

  return groups;
}

async function buildTasteRecommendations(
  commonHighlyRated: RatedFilm[],
  sharedGenres: string[],
  sharedDirectors: string[],
  excludeIds: number[],
): Promise<RecommendedFilm[]> {
  if (!isTmdbConfigured()) return [];

  const candidates = new Map<number, ScoredCandidate>();

  const enrichedCommon = await enrichFilms(commonHighlyRated.slice(0, 6), 6);

  for (const film of enrichedCommon) {
    if (!film.tmdbId) continue;

    const recs = await getMovieRecommendations(film.tmdbId, excludeIds);
    for (const rec of recs.slice(0, 6)) {
      addCandidate(candidates, {
        tmdbId: rec.id,
        title: rec.title,
        year: rec.release_date
          ? parseInt(rec.release_date.slice(0, 4), 10)
          : undefined,
        posterPath: rec.poster_path,
        score: 4,
        reason: `Similar to ${film.title} — a film you both rated highly`,
      });
    }
  }

  for (const genre of sharedGenres.slice(0, 3)) {
    const genreId = mapGenreToTmdbId(genre);
    if (!genreId) continue;

    const results = await discoverMovies({
      genreIds: [genreId],
      excludeIds,
    });

    for (const rec of results.slice(0, 5)) {
      addCandidate(candidates, {
        tmdbId: rec.id,
        title: rec.title,
        year: rec.release_date
          ? parseInt(rec.release_date.slice(0, 4), 10)
          : undefined,
        posterPath: rec.poster_path,
        score: 3,
        reason: `Matches your shared taste for ${genre}`,
      });
    }
  }

  for (const director of sharedDirectors.slice(0, 4)) {
    const personId = await searchPersonId(director);
    if (!personId) continue;

    const results = await discoverMovies({
      personId,
      excludeIds,
    });

    for (const rec of results.slice(0, 4)) {
      addCandidate(candidates, {
        tmdbId: rec.id,
        title: rec.title,
        year: rec.release_date
          ? parseInt(rec.release_date.slice(0, 4), 10)
          : undefined,
        posterPath: rec.poster_path,
        score: 3,
        reason: `From ${director} — a director you both enjoy`,
      });
    }
  }

  const sorted = Array.from(candidates.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);

  const enriched: RecommendedFilm[] = [];

  for (const candidate of sorted) {
    const film = await enrichFilm({
      slug: `tmdb-${candidate.tmdbId}`,
      title: candidate.title,
      year: candidate.year,
    });

    enriched.push({
      ...film,
      tmdbId: candidate.tmdbId,
      posterPath: film.posterPath ?? candidate.posterPath,
      reason: Array.from(candidate.reasons).slice(0, 2).join(" · "),
      matchScore: Math.min(99, candidate.score * 8 + 20),
    });
  }

  return enriched;
}

export async function buildRecommendationBundle(
  user1: ParticipantData,
  user2: ParticipantData,
  commonWatchlist: LetterboxdFilm[],
): Promise<{
  tasteProfile: TasteProfile;
  genreRecommendations: GenreRecommendationGroup[];
  recommendations: RecommendedFilm[];
}> {
  const commonHighlyRatedRaw = intersectRatedFilms(
    user1.filmsRated,
    user2.filmsRated,
  );

  const sharedGenres = sharedGenresByWeight(user1, user2);
  const sharedDirectors = sharedDirectorNames(user1, user2);

  const commonHighlyRated = await enrichFilms(
    commonHighlyRatedRaw.slice(0, 12),
    12,
  );

  const allWatched = [...user1.filmsWatched, ...user2.filmsWatched];
  const enrichedWatched = await enrichFilms(allWatched, 40);
  const excludeIds = Array.from(
    buildExcludeTmdbIds(user1, user2, enrichedWatched),
  );

  for (const film of await enrichFilms(commonWatchlist, 40)) {
    if (film.tmdbId) excludeIds.push(film.tmdbId);
  }

  const [genreRecommendations, recommendations] = await Promise.all([
    buildGenreRecommendations(sharedGenres, excludeIds),
    buildTasteRecommendations(
      commonHighlyRatedRaw,
      sharedGenres,
      sharedDirectors,
      excludeIds,
    ),
  ]);

  return {
    tasteProfile: {
      sharedGenres,
      sharedDirectors,
      commonHighlyRated,
    },
    genreRecommendations,
    recommendations,
  };
}
