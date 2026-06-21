import { buildExplanation } from "@/lib/blend/explain";
import { intersectRatedFilms } from "@/lib/blend/taste";
import {
  discoverMovies,
  enrichFilmsBatch,
  getMovieRecommendations,
  getSimilarMovies,
  isTmdbConfigured,
  mapGenreToTmdbId,
  searchPersonId,
  tmdbResultToEnriched,
} from "@/lib/tmdb/client";
import type {
  EnrichedFilm,
  ParticipantData,
  RatedFilm,
  RecommendedFilm,
  TasteProfile,
} from "@/types/blend";

const HIGH_RATING_THRESHOLD = 4;
const TARGET = 24;
const BACKFILL_PAGE_BUDGET = 8;

interface ScoredCandidate {
  tmdbId: number;
  title: string;
  year?: number;
  posterPath?: string | null;
  score: number;
  reasons: Set<string>;
  seedTitles: Set<string>;
  matchedGenres: Set<string>;
  matchedDirectors: Set<string>;
  tmdbSources: Set<"recommendations" | "similar" | "discover">;
}

function topRatedFilms(user: ParticipantData, limit = 8): RatedFilm[] {
  return [...user.filmsRated]
    .filter((film) => film.rating >= HIGH_RATING_THRESHOLD)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}

function tasteSeedFilms(
  user1: ParticipantData,
  user2: ParticipantData,
  commonHighlyRated: RatedFilm[],
): RatedFilm[] {
  const bySlug = new Map<string, RatedFilm>();

  for (const film of commonHighlyRated) {
    bySlug.set(film.slug, { ...film, rating: film.rating + 1 });
  }

  for (const film of topRatedFilms(user1, 6)) {
    bySlug.set(film.slug, bySlug.get(film.slug) ?? film);
  }

  for (const film of topRatedFilms(user2, 6)) {
    bySlug.set(film.slug, bySlug.get(film.slug) ?? film);
  }

  return Array.from(bySlug.values())
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 12);
}

function addCandidate(
  map: Map<number, ScoredCandidate>,
  candidate: {
    tmdbId: number;
    title: string;
    year?: number;
    posterPath?: string | null;
    score: number;
    reason: string;
    seedTitle?: string;
    genre?: string;
    director?: string;
    tmdbSource: "recommendations" | "similar" | "discover";
  },
) {
  const existing = map.get(candidate.tmdbId);
  if (existing) {
    existing.score += candidate.score;
    existing.reasons.add(candidate.reason);
    if (candidate.seedTitle) existing.seedTitles.add(candidate.seedTitle);
    if (candidate.genre) existing.matchedGenres.add(candidate.genre);
    if (candidate.director) existing.matchedDirectors.add(candidate.director);
    existing.tmdbSources.add(candidate.tmdbSource);
    return;
  }

  map.set(candidate.tmdbId, {
    tmdbId: candidate.tmdbId,
    title: candidate.title,
    year: candidate.year,
    posterPath: candidate.posterPath,
    score: candidate.score,
    reasons: new Set([candidate.reason]),
    seedTitles: new Set(candidate.seedTitle ? [candidate.seedTitle] : []),
    matchedGenres: new Set(candidate.genre ? [candidate.genre] : []),
    matchedDirectors: new Set(candidate.director ? [candidate.director] : []),
    tmdbSources: new Set([candidate.tmdbSource]),
  });
}

function genreDiscoverWeight(rank: number): number {
  return Math.max(3, 7 - Math.floor(rank / 2));
}

function isSeen(tmdbId: number, seenTmdbIds: Set<number>): boolean {
  return seenTmdbIds.has(tmdbId);
}

async function backfillCandidates(
  candidates: Map<number, ScoredCandidate>,
  tasteProfile: TasteProfile,
  seenTmdbIds: Set<number>,
  excludeIds: number[],
): Promise<void> {
  const chosenIds = new Set([...seenTmdbIds, ...candidates.keys()]);
  const exclude = Array.from(chosenIds);

  for (let page = 2; page <= BACKFILL_PAGE_BUDGET; page += 1) {
    if (candidates.size >= TARGET) return;

    for (const genrePref of tasteProfile.sharedGenresRanked.slice(0, 3)) {
      const genreId = mapGenreToTmdbId(genrePref.name);
      if (!genreId) continue;

      const results = await discoverMovies({
        genreIds: [genreId],
        excludeIds: exclude,
        page,
      });

      for (const rec of results) {
        if (isSeen(rec.id, seenTmdbIds) || candidates.has(rec.id)) continue;
        addCandidate(candidates, {
          tmdbId: rec.id,
          title: rec.title,
          year: rec.release_date
            ? parseInt(rec.release_date.slice(0, 4), 10)
            : undefined,
          posterPath: rec.poster_path,
          score: 1,
          reason: `Backfill from shared ${genrePref.name} taste`,
          genre: genrePref.name,
          tmdbSource: "discover",
        });
        chosenIds.add(rec.id);
        if (candidates.size >= TARGET) return;
      }
    }

    const popular = await discoverMovies({
      excludeIds: Array.from(chosenIds),
      page,
      sortBy: "popularity.desc",
    });

    for (const rec of popular) {
      if (isSeen(rec.id, seenTmdbIds) || candidates.has(rec.id)) continue;
      addCandidate(candidates, {
        tmdbId: rec.id,
        title: rec.title,
        year: rec.release_date
          ? parseInt(rec.release_date.slice(0, 4), 10)
          : undefined,
        posterPath: rec.poster_path,
        score: 1,
        reason: "Popular pick you may both enjoy",
        tmdbSource: "discover",
      });
      chosenIds.add(rec.id);
      if (candidates.size >= TARGET) return;
    }
  }
}

async function buildTasteRecommendations(
  user1: ParticipantData,
  user2: ParticipantData,
  tasteProfile: TasteProfile,
  seenTmdbIds: Set<number>,
): Promise<RecommendedFilm[]> {
  if (!isTmdbConfigured()) return [];

  const excludeIds = Array.from(seenTmdbIds);
  const commonHighlyRated = intersectRatedFilms(
    user1.filmsRated,
    user2.filmsRated,
    user1.filmsWatched as EnrichedFilm[],
    user2.filmsWatched as EnrichedFilm[],
  );
  const seedFilms = tasteSeedFilms(user1, user2, commonHighlyRated);
  const candidates = new Map<number, ScoredCandidate>();
  const enrichedSeeds = await enrichFilmsBatch(seedFilms);

  const topGenre = tasteProfile.topSharedGenre?.name;
  const topDirector = tasteProfile.topSharedDirector?.name;

  for (const film of enrichedSeeds) {
    if (!film.tmdbId || isSeen(film.tmdbId, seenTmdbIds)) continue;

    const [recs, similar] = await Promise.all([
      getMovieRecommendations(film.tmdbId, excludeIds),
      getSimilarMovies(film.tmdbId, excludeIds),
    ]);

    for (const rec of recs.slice(0, 5)) {
      if (isSeen(rec.id, seenTmdbIds)) continue;
      addCandidate(candidates, {
        tmdbId: rec.id,
        title: rec.title,
        year: rec.release_date
          ? parseInt(rec.release_date.slice(0, 4), 10)
          : undefined,
        posterPath: rec.poster_path,
        score: 4,
        reason: `Similar to ${film.title}`,
        seedTitle: film.title,
        tmdbSource: "recommendations",
      });
    }

    for (const rec of similar.slice(0, 3)) {
      if (isSeen(rec.id, seenTmdbIds)) continue;
      addCandidate(candidates, {
        tmdbId: rec.id,
        title: rec.title,
        year: rec.release_date
          ? parseInt(rec.release_date.slice(0, 4), 10)
          : undefined,
        posterPath: rec.poster_path,
        score: 2,
        reason: `In the same vein as ${film.title}`,
        seedTitle: film.title,
        tmdbSource: "similar",
      });
    }
  }

  for (const genrePref of tasteProfile.sharedGenresRanked.slice(0, 3)) {
    const genreId = mapGenreToTmdbId(genrePref.name);
    if (!genreId) continue;

    const weight = genreDiscoverWeight(genrePref.rank);
    const results = await discoverMovies({
      genreIds: [genreId],
      excludeIds,
    });

    for (const rec of results.slice(0, 5)) {
      if (isSeen(rec.id, seenTmdbIds)) continue;
      const bonus = genrePref.name === topGenre ? 5 : 0;
      addCandidate(candidates, {
        tmdbId: rec.id,
        title: rec.title,
        year: rec.release_date
          ? parseInt(rec.release_date.slice(0, 4), 10)
          : undefined,
        posterPath: rec.poster_path,
        score: weight + bonus,
        reason: `Matches shared taste for ${genrePref.name}`,
        genre: genrePref.name,
        tmdbSource: "discover",
      });
    }
  }

  for (const directorPref of tasteProfile.sharedDirectorsRanked.slice(0, 4)) {
    const personId = await searchPersonId(directorPref.name);
    if (!personId) continue;

    const bonus = directorPref.name === topDirector ? 5 : 0;
    const results = await discoverMovies({ personId, excludeIds });

    for (const rec of results.slice(0, 4)) {
      if (isSeen(rec.id, seenTmdbIds)) continue;
      addCandidate(candidates, {
        tmdbId: rec.id,
        title: rec.title,
        year: rec.release_date
          ? parseInt(rec.release_date.slice(0, 4), 10)
          : undefined,
        posterPath: rec.poster_path,
        score: 3 + bonus,
        reason: `From ${directorPref.name}`,
        director: directorPref.name,
        tmdbSource: "discover",
      });
    }
  }

  let sorted = Array.from(candidates.values())
    .filter((candidate) => !isSeen(candidate.tmdbId, seenTmdbIds))
    .sort((a, b) => b.score - a.score);

  if (sorted.length < TARGET) {
    await backfillCandidates(candidates, tasteProfile, seenTmdbIds, excludeIds);
    sorted = Array.from(candidates.values())
      .filter((candidate) => !isSeen(candidate.tmdbId, seenTmdbIds))
      .sort((a, b) => b.score - a.score);
  }

  sorted = sorted.slice(0, TARGET);

  const enriched: RecommendedFilm[] = [];

  const enrichedCandidates = await enrichFilmsBatch(
    sorted.map((candidate) => ({
      slug: `tmdb-${candidate.tmdbId}`,
      title: candidate.title,
      year: candidate.year,
    })),
  );

  for (const [index, candidate] of sorted.entries()) {
    if (isSeen(candidate.tmdbId, seenTmdbIds)) continue;

    const film =
      enrichedCandidates[index] ??
      tmdbResultToEnriched({
        id: candidate.tmdbId,
        title: candidate.title,
        release_date: candidate.year ? `${candidate.year}-01-01` : undefined,
        poster_path: candidate.posterPath,
      });

    const matchedGenres = Array.from(candidate.matchedGenres);
    const matchedDirectors = Array.from(candidate.matchedDirectors);

    if (
      topGenre &&
      (film.genres ?? []).some(
        (g) => g.toLowerCase() === topGenre.toLowerCase(),
      )
    ) {
      matchedGenres.push(topGenre);
    }

    if (
      topDirector &&
      (film.directors ?? []).some(
        (d) => d.toLowerCase() === topDirector.toLowerCase(),
      )
    ) {
      matchedDirectors.push(topDirector);
    }

    const rank = index + 1;
    const explanation = buildExplanation({
      title: candidate.title,
      seedTitles: Array.from(candidate.seedTitles),
      matchedGenres: [...new Set(matchedGenres)],
      matchedDirectors: [...new Set(matchedDirectors)],
      tmdbSources: Array.from(candidate.tmdbSources),
      tasteProfile,
      rank,
    });

    enriched.push({
      ...film,
      tmdbId: candidate.tmdbId,
      posterPath: film.posterPath ?? candidate.posterPath,
      rank,
      reason: Array.from(candidate.reasons).slice(0, 2).join(" · "),
      matchScore: Math.min(99, candidate.score * 8 + 20),
      explanation,
    });
  }

  return enriched.filter((film) => !film.tmdbId || !isSeen(film.tmdbId, seenTmdbIds));
}

export async function buildRecommendationBundle(
  user1: ParticipantData,
  user2: ParticipantData,
  tasteProfile: TasteProfile,
  seenTmdbIds: Set<number>,
): Promise<RecommendedFilm[]> {
  return buildTasteRecommendations(user1, user2, tasteProfile, seenTmdbIds);
}
