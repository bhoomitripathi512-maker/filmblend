import { buildExplanation } from "@/lib/blend/explain";
import { normalizeTitle } from "@/lib/blend/matching";
import { intersectRatedFilms, normalizePreferenceName } from "@/lib/blend/taste";
import {
  discoverCriterionMovies,
  discoverIndieMovies,
  discoverMovies,
  enrichFilmsBatch,
  getSimilarMovies,
  isTmdbConfigured,
  mapGenreToTmdbId,
  searchPersonId,
  tmdbResultToEnriched,
} from "@/lib/tmdb/client";
import {
  artHouseBoost,
  isArtHouseCandidate,
  isFestivalCanon,
  isMainstreamBlock,
  type ArtHouseSignals,
} from "@/lib/tmdb/art-house";
import type {
  EnrichedFilm,
  ParticipantData,
  RatedFilm,
  RecommendedFilm,
  LetterboxdFilm,
  TasteProfile,
  WeightedPreference,
} from "@/types/blend";

const HIGH_RATING_THRESHOLD = 4;
const TARGET = 24;
const RANK_POOL = 36;
const BACKFILL_PAGE_BUDGET = 1;
const SEED_LIMIT = 6;
const SEED_POOL = 14;
const SEED_BATCH_SIZE = 5;

/** Boutique / festival / Criterion-scale titles on TMDB. */
export const NICHE_VOTE_MIN = 40;
export const NICHE_VOTE_MAX = 2500;
export const NICHE_VOTE_PEAK = 650;
export const NICHE_POPULARITY_MAX = 22;

/** Hard-reject obvious mainstream unless festival/Criterion canon. */
export const BLOCKBUSTER_VOTE_COUNT = 4000;
export const BLOCKBUSTER_POPULARITY = 32;

const SIMILAR_BASE_SCORE = 10;
const MULTI_SEED_BONUS = 7;
const CRITERION_DISCOVER_SCORE = 4;
const INDIE_DISCOVER_SCORE = 3.5;
const DIRECTOR_DISCOVER_SCORE = 6;
const GENRE_DISCOVER_SCORE = 3;
const TASTE_FIT_WEIGHT = 0.55;
const AFFINITY_WEIGHT = 3.8;
const NICHE_BONUS_WEIGHT = 2.5;
const ART_HOUSE_WEIGHT = 3.2;
const MAINSTREAM_PENALTY_WEIGHT = 0.18;
const SEED_CONNECTION_BONUS = 9;
const CATALOG_ONLY_PENALTY = 7;

const MAX_PER_DIRECTOR = 2;
const MAX_PER_GENRE = 5;
const MAX_PER_DECADE = 4;

function candidateToFilm(candidate: ScoredCandidate): EnrichedFilm {
  return tmdbResultToEnriched({
    id: candidate.tmdbId,
    title: candidate.title,
    release_date: candidate.year ? `${candidate.year}-01-01` : undefined,
    poster_path: candidate.posterPath,
    popularity: candidate.popularity,
    vote_count: candidate.voteCount,
    vote_average: candidate.voteAverage,
    original_language: candidate.originalLanguage ?? undefined,
  });
}

function filterCandidates(
  candidates: Map<number, ScoredCandidate>,
  seenTmdbIds: Set<number>,
): ScoredCandidate[] {
  return Array.from(candidates.values())
    .filter((candidate) => {
      if (isSeen(candidate.tmdbId, seenTmdbIds)) return false;
      const signals: ArtHouseSignals = {
        tmdbId: candidate.tmdbId,
        voteAverage: candidate.voteAverage,
        voteCount: candidate.voteCount,
        popularity: candidate.popularity,
        originalLanguage: candidate.originalLanguage,
      };
      return passesArtHouseGate(candidate, signals);
    })
    .sort((a, b) => b.score - a.score);
}

interface TasteSeed {
  film: EnrichedFilm;
  rating: number;
  weight: number;
}

interface ScoredCandidate {
  tmdbId: number;
  title: string;
  year?: number;
  posterPath?: string | null;
  popularity?: number;
  voteCount?: number;
  voteAverage?: number;
  originalLanguage?: string | null;
  score: number;
  seedConnections: number;
  reasons: Set<string>;
  seedTitles: Set<string>;
  matchedGenres: Set<string>;
  matchedDirectors: Set<string>;
  tmdbSources: Set<"recommendations" | "similar" | "discover" | "criterion" | "festival">;
}

interface RankedCandidate {
  candidate: ScoredCandidate;
  film: EnrichedFilm;
  finalScore: number;
}

function blendHash(
  user1: ParticipantData,
  user2: ParticipantData,
  salt = "",
): number {
  const key = [
    ...[user1.letterboxdUsername, user2.letterboxdUsername].sort(),
    salt,
  ].join("|");
  let hash = 0;
  for (const char of key) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

function rotateSlice<T>(items: T[], hash: number, count: number): T[] {
  if (items.length <= count) return items;
  const start = hash % (items.length - count + 1);
  return items.slice(start, start + count);
}

function uniquePreferences(
  prefs: WeightedPreference[],
): WeightedPreference[] {
  const seen = new Set<string>();
  const unique: WeightedPreference[] = [];
  for (const pref of prefs) {
    const key = normalizePreferenceName(pref.name);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(pref);
  }
  return unique;
}

function discoverGenresForBlend(
  tasteProfile: TasteProfile,
  hash: number,
): WeightedPreference[] {
  const pool = uniquePreferences([
    ...tasteProfile.sharedGenresRanked,
    ...tasteProfile.user1TopGenres.slice(0, 4),
    ...tasteProfile.user2TopGenres.slice(0, 4),
  ]);
  return rotateSlice(pool, hash, Math.min(3, pool.length));
}

function discoverDirectorsForBlend(
  tasteProfile: TasteProfile,
  hash: number,
): WeightedPreference[] {
  const pool = uniquePreferences([
    ...tasteProfile.sharedDirectorsRanked,
    ...tasteProfile.user1TopDirectors.slice(0, 4),
    ...tasteProfile.user2TopDirectors.slice(0, 4),
  ]);
  return rotateSlice(pool, hash >> 3, Math.min(3, pool.length));
}

function blendDiscoverPage(
  user1: ParticipantData,
  user2: ParticipantData,
  salt = "",
): number {
  return 1 + (blendHash(user1, user2, salt) % 7);
}

function isCatalogOnlyCandidate(candidate: ScoredCandidate): boolean {
  if (candidate.seedConnections > 0) return false;
  if (candidate.matchedDirectors.size > 0) return false;
  return (
    candidate.tmdbSources.has("criterion") ||
    (candidate.tmdbSources.has("discover") && !candidate.tmdbSources.has("similar"))
  );
}

function preferenceScoreMap(
  prefs: WeightedPreference[],
): Map<string, number> {
  return new Map(
    prefs.map((pref) => [normalizePreferenceName(pref.name), pref.score]),
  );
}

export function tasteFitScore(
  film: EnrichedFilm,
  user1Genres: Map<string, number>,
  user2Genres: Map<string, number>,
  user1Directors: Map<string, number>,
  user2Directors: Map<string, number>,
): number {
  let score = 0;
  for (const genre of film.genres ?? []) {
    const key = normalizePreferenceName(genre);
    score += (user1Genres.get(key) ?? 0) + (user2Genres.get(key) ?? 0);
  }
  for (const director of film.directors ?? []) {
    const key = normalizePreferenceName(director);
    score += (user1Directors.get(key) ?? 0) + (user2Directors.get(key) ?? 0);
  }
  return score;
}

export function enrichedFilmSimilarity(a: EnrichedFilm, b: EnrichedFilm): number {
  let similarity = 0;

  const aDirectors = new Set(
    (a.directors ?? []).map((name) => normalizePreferenceName(name)),
  );
  for (const director of b.directors ?? []) {
    if (aDirectors.has(normalizePreferenceName(director))) similarity += 3;
  }

  const aGenres = new Set(
    (a.genres ?? []).map((name) => normalizePreferenceName(name)),
  );
  for (const genre of b.genres ?? []) {
    if (aGenres.has(normalizePreferenceName(genre))) similarity += 1.2;
  }

  if (a.year && b.year) {
    const gap = Math.abs(a.year - b.year);
    if (gap <= 2) similarity += 2;
    else if (gap <= 5) similarity += 1;
    else if (Math.floor(a.year / 10) === Math.floor(b.year / 10)) similarity += 0.4;
  }

  if (a.runtime && b.runtime) {
    const runtimeGap = Math.abs(a.runtime - b.runtime);
    if (runtimeGap <= 15) similarity += 1;
    else if (runtimeGap <= 30) similarity += 0.5;
  }

  return similarity;
}

export function nicheAppeal(
  voteCount?: number,
  popularity?: number,
): number {
  const votes = voteCount ?? 0;
  const pop = popularity ?? 0;

  if (votes < NICHE_VOTE_MIN || votes > NICHE_VOTE_MAX + 1500) return -1.5;
  if (pop > NICHE_POPULARITY_MAX) return -2;

  const voteDistance = Math.abs(votes - NICHE_VOTE_PEAK);
  const voteCurve = Math.max(0, 3.5 - voteDistance / 650);
  const popCurve = Math.max(0, 2.2 - pop / 18);

  return voteCurve + popCurve;
}

export function isBlockbuster(candidate: {
  popularity?: number;
  voteCount?: number;
}): boolean {
  return isMainstreamBlock({
    tmdbId: 0,
    popularity: candidate.popularity,
    voteCount: candidate.voteCount,
  });
}

function signalsFromSearchResult(result: {
  id: number;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  original_language?: string;
}): ArtHouseSignals {
  return {
    tmdbId: result.id,
    voteAverage: result.vote_average,
    voteCount: result.vote_count,
    popularity: result.popularity,
    originalLanguage: result.original_language,
  };
}

function searchResultFields(rec: {
  id: number;
  title: string;
  poster_path?: string | null;
  popularity?: number;
  vote_count?: number;
  vote_average?: number;
  original_language?: string;
  release_date?: string;
}) {
  return {
    tmdbId: rec.id,
    title: rec.title,
    year: rec.release_date
      ? parseInt(rec.release_date.slice(0, 4), 10)
      : undefined,
    posterPath: rec.poster_path,
    popularity: rec.popularity,
    voteCount: rec.vote_count,
    voteAverage: rec.vote_average,
    originalLanguage: rec.original_language,
  };
}

function signalsFromFilm(film: EnrichedFilm): ArtHouseSignals {
  return {
    tmdbId: film.tmdbId ?? 0,
    voteAverage: film.voteAverage,
    voteCount: film.voteCount,
    popularity: film.popularity,
    originalLanguage: film.originalLanguage,
  };
}

function candidateSimilarity(a: EnrichedFilm, b: EnrichedFilm): number {
  return enrichedFilmSimilarity(a, b);
}

function decadeKey(year?: number): string {
  if (!year) return "unknown";
  return `${Math.floor(year / 10) * 10}s`;
}

function diversifyCandidates(
  ranked: RankedCandidate[],
  limit: number,
): RankedCandidate[] {
  const picked: RankedCandidate[] = [];
  const remaining = [...ranked];
  const directorCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  const decadeCounts = new Map<string, number>();

  const violatesCaps = (film: EnrichedFilm): boolean => {
    for (const director of film.directors ?? []) {
      if ((directorCounts.get(normalizePreferenceName(director)) ?? 0) >= MAX_PER_DIRECTOR) {
        return true;
      }
    }
    for (const genre of film.genres ?? []) {
      if ((genreCounts.get(normalizePreferenceName(genre)) ?? 0) >= MAX_PER_GENRE) {
        return true;
      }
    }
    if ((decadeCounts.get(decadeKey(film.year)) ?? 0) >= MAX_PER_DECADE) {
      return true;
    }
    return false;
  };

  const recordPick = (film: EnrichedFilm) => {
    for (const director of film.directors ?? []) {
      const key = normalizePreferenceName(director);
      directorCounts.set(key, (directorCounts.get(key) ?? 0) + 1);
    }
    for (const genre of film.genres ?? []) {
      const key = normalizePreferenceName(genre);
      genreCounts.set(key, (genreCounts.get(key) ?? 0) + 1);
    }
    decadeCounts.set(
      decadeKey(film.year),
      (decadeCounts.get(decadeKey(film.year)) ?? 0) + 1,
    );
  };

  while (picked.length < limit && remaining.length > 0) {
    let bestIndex = -1;
    let bestScore = -Infinity;

    for (const [index, item] of remaining.entries()) {
      if (violatesCaps(item.film)) continue;

      const maxSimilarity = picked.reduce(
        (max, chosen) =>
          Math.max(max, candidateSimilarity(chosen.film, item.film)),
        0,
      );
      const adjusted = item.finalScore - maxSimilarity * 0.45;
      if (adjusted > bestScore) {
        bestScore = adjusted;
        bestIndex = index;
      }
    }

    if (bestIndex === -1) {
      const [fallback] = remaining.splice(0, 1);
      picked.push(fallback);
      recordPick(fallback.film);
      continue;
    }

    const [chosen] = remaining.splice(bestIndex, 1);
    picked.push(chosen);
    recordPick(chosen.film);
  }

  return picked;
}

function topRatedFilms(user: ParticipantData, limit = 10): RatedFilm[] {
  return [...user.filmsRated]
    .filter((film) => film.rating >= HIGH_RATING_THRESHOLD)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}

export function seedPriority(
  rating: number,
  enriched?: EnrichedFilm,
): number {
  let score = rating * 12;
  const votes = enriched?.voteCount ?? 0;
  const pop = enriched?.popularity ?? 0;

  if (votes >= BLOCKBUSTER_VOTE_COUNT) score -= 8;
  else if (votes >= 4500) score -= 3;
  else if (votes >= NICHE_VOTE_MIN && votes <= NICHE_VOTE_MAX) score += 4;

  if (pop >= BLOCKBUSTER_POPULARITY) score -= 6;
  else if (pop <= NICHE_POPULARITY_MAX) score += 3;

  return score;
}

async function buildTasteSeeds(
  user1: ParticipantData,
  user2: ParticipantData,
  commonHighlyRated: RatedFilm[],
  preEnrichedCommon: EnrichedFilm[] = [],
  salt = "",
): Promise<TasteSeed[]> {
  const user1Top = topRatedFilms(user1, 10);
  const user2Top = topRatedFilms(user2, 10);
  const ratedBySlug = new Map<string, RatedFilm>();

  for (const film of commonHighlyRated) {
    ratedBySlug.set(film.slug, { ...film, rating: film.rating + 0.5 });
  }
  for (const film of user1Top) {
    ratedBySlug.set(film.slug, ratedBySlug.get(film.slug) ?? film);
  }
  for (const film of user2Top) {
    ratedBySlug.set(film.slug, ratedBySlug.get(film.slug) ?? film);
  }

  const rated = Array.from(ratedBySlug.values());
  const enrichedBySlug = new Map(
    [
      ...preEnrichedCommon,
      ...(await enrichFilmsBatch(
        rated.filter(
          (film) =>
            !preEnrichedCommon.some(
              (existing) => existing.slug === film.slug && existing.tmdbId,
            ),
        ),
      )),
    ].map((film) => [film.slug, film] as const),
  );

  const seeds: TasteSeed[] = rated
    .map((film) => {
      const enrichedFilm = enrichedBySlug.get(film.slug);
      if (!enrichedFilm?.tmdbId) return null;
      const weight = seedPriority(film.rating, enrichedFilm) / 12;
      return { film: enrichedFilm, rating: film.rating, weight };
    })
    .filter((seed): seed is TasteSeed => seed !== null)
    .sort((a, b) => seedPriority(b.rating, b.film) - seedPriority(a.rating, a.film));

  const pool = seeds.slice(0, SEED_POOL);
  const hash = blendHash(user1, user2, salt);
  return rotateSlice(pool, hash >> 5, Math.min(SEED_LIMIT, pool.length));
}

function addCandidate(
  map: Map<number, ScoredCandidate>,
  candidate: {
    tmdbId: number;
    title: string;
    year?: number;
    posterPath?: string | null;
    popularity?: number;
    voteCount?: number;
    voteAverage?: number;
    originalLanguage?: string | null;
    score: number;
    reason: string;
    seedTitle?: string;
    genre?: string;
    director?: string;
    tmdbSource: "recommendations" | "similar" | "discover" | "criterion" | "festival";
    seedConnection?: boolean;
  },
) {
  const existing = map.get(candidate.tmdbId);
  if (existing) {
    existing.score += candidate.score;
    if (candidate.seedConnection) {
      existing.seedConnections += 1;
      existing.score += MULTI_SEED_BONUS;
    }
    existing.popularity = Math.min(
      existing.popularity ?? Number.POSITIVE_INFINITY,
      candidate.popularity ?? Number.POSITIVE_INFINITY,
    );
    existing.voteCount = Math.min(
      existing.voteCount ?? Number.POSITIVE_INFINITY,
      candidate.voteCount ?? Number.POSITIVE_INFINITY,
    );
    existing.voteAverage = Math.max(
      existing.voteAverage ?? 0,
      candidate.voteAverage ?? 0,
    );
    if (candidate.originalLanguage) {
      existing.originalLanguage = candidate.originalLanguage;
    }
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
    popularity: candidate.popularity,
    voteCount: candidate.voteCount,
    voteAverage: candidate.voteAverage,
    originalLanguage: candidate.originalLanguage,
    score: candidate.score,
    seedConnections: candidate.seedConnection ? 1 : 0,
    reasons: new Set([candidate.reason]),
    seedTitles: new Set(candidate.seedTitle ? [candidate.seedTitle] : []),
    matchedGenres: new Set(candidate.genre ? [candidate.genre] : []),
    matchedDirectors: new Set(candidate.director ? [candidate.director] : []),
    tmdbSources: new Set([candidate.tmdbSource]),
  });
}

function isSeen(tmdbId: number, seenTmdbIds: Set<number>): boolean {
  return seenTmdbIds.has(tmdbId);
}

function rawSeenKeys(films: LetterboxdFilm[]): Set<string> {
  const keys = new Set<string>();
  for (const film of films) {
    const title = normalizeTitle(film.title);
    keys.add(`title:${title}`);
    if (film.year) {
      keys.add(`title:${title}|${film.year}`);
    }
  }
  return keys;
}

function isRawSeen(
  film: { title: string; year?: number },
  seenKeys: Set<string>,
): boolean {
  const title = normalizeTitle(film.title);
  return (
    seenKeys.has(`title:${title}`) ||
    (film.year ? seenKeys.has(`title:${title}|${film.year}`) : false)
  );
}

function passesArtHouseGate(
  candidate: ScoredCandidate,
  signals: ArtHouseSignals,
): boolean {
  if (isFestivalCanon(signals.tmdbId)) return true;
  if (isMainstreamBlock(signals)) return false;

  if (candidate.tmdbSources.has("criterion")) {
    return !isMainstreamBlock(signals);
  }
  if (candidate.tmdbSources.has("festival") && isArtHouseCandidate(signals)) {
    return true;
  }

  if (candidate.seedConnections >= 2 && isArtHouseCandidate(signals)) return true;

  if (
    candidate.seedConnections >= 1 &&
    candidate.tmdbSources.has("similar") &&
    isArtHouseCandidate(signals)
  ) {
    return true;
  }

  if (
    candidate.tmdbSources.has("discover") &&
    (candidate.tmdbSources.has("criterion") ||
      candidate.matchedDirectors.size > 0) &&
    isArtHouseCandidate(signals)
  ) {
    return true;
  }

  return isArtHouseCandidate(signals) && candidate.score >= GENRE_DISCOVER_SCORE;
}

function mainstreamPenalty(candidate: ScoredCandidate): number {
  const votes = candidate.voteCount ?? 0;
  const pop = candidate.popularity ?? 0;
  return votes * 0.00035 + pop * MAINSTREAM_PENALTY_WEIGHT;
}

function maxSeedAffinity(
  film: EnrichedFilm,
  seeds: TasteSeed[],
): number {
  let max = 0;
  for (const seed of seeds) {
    const affinity = enrichedFilmSimilarity(film, seed.film) * seed.weight;
    max = Math.max(max, affinity);
  }
  return max;
}

async function expandFromSeeds(
  seeds: TasteSeed[],
  candidates: Map<number, ScoredCandidate>,
  seenTmdbIds: Set<number>,
  seenRaw: Set<string>,
  excludeIds: number[],
  user1: ParticipantData,
  user2: ParticipantData,
  salt = "",
): Promise<void> {
  const hash = blendHash(user1, user2, salt);

  async function expandSeed(seed: TasteSeed) {
    if (!seed.film.tmdbId) return;

    const similar = await getSimilarMovies(seed.film.tmdbId, excludeIds);
    const offset = hash % 4;
    const window = similar.slice(offset, offset + 10);

    for (const [index, rec] of window.entries()) {
      const recYear = rec.release_date
        ? parseInt(rec.release_date.slice(0, 4), 10)
        : undefined;
      if (
        isSeen(rec.id, seenTmdbIds) ||
        isRawSeen({ title: rec.title, year: recYear }, seenRaw)
      ) continue;

      const signals = signalsFromSearchResult(rec);
      if (!isArtHouseCandidate(signals) && !isFestivalCanon(rec.id)) continue;
      if (isMainstreamBlock(signals)) continue;

      const depthDecay = Math.max(0.5, 1 - index * 0.04);
      addCandidate(candidates, {
        ...searchResultFields(rec),
        score:
          SIMILAR_BASE_SCORE * seed.weight * depthDecay +
          artHouseBoost(signals) * 0.35,
        reason: isFestivalCanon(rec.id)
          ? `Festival-circuit match to ${seed.film.title}`
          : `Indie-adjacent to ${seed.film.title}`,
        seedTitle: seed.film.title,
        tmdbSource: "similar",
        seedConnection: true,
      });
    }
  }

  for (let index = 0; index < seeds.length; index += SEED_BATCH_SIZE) {
    await Promise.all(
      seeds.slice(index, index + SEED_BATCH_SIZE).map((seed) => expandSeed(seed)),
    );
  }
}

async function discoverArtHouseCatalog(
  candidates: Map<number, ScoredCandidate>,
  tasteProfile: TasteProfile,
  seenTmdbIds: Set<number>,
  seenRaw: Set<string>,
  excludeIds: number[],
  user1: ParticipantData,
  user2: ParticipantData,
  salt = "",
): Promise<void> {
  const hash = blendHash(user1, user2, salt);
  const discoverPage = blendDiscoverPage(user1, user2, salt);
  const topGenre = tasteProfile.topSharedGenre?.name;
  const topDirector = tasteProfile.topSharedDirector?.name;
  const genres = discoverGenresForBlend(tasteProfile, hash);

  await Promise.all(
    genres.map(async (genrePref, genreIndex) => {
      const genreId = mapGenreToTmdbId(genrePref.name);
      if (!genreId) return;

      const page = discoverPage + genreIndex + (hash % 2);
      const [criterionResults, indieResults] = await Promise.all([
        discoverCriterionMovies({
          genreIds: [genreId],
          excludeIds,
          page,
        }),
        discoverIndieMovies({
          genreIds: [genreId],
          excludeIds,
          page: page + 1,
        }),
      ]);

      const criterionSlice = rotateSlice(
        criterionResults,
        hash + genreIndex,
        Math.min(5, criterionResults.length),
      );
      const indieSlice = rotateSlice(
        indieResults,
        (hash >> 2) + genreIndex,
        Math.min(4, indieResults.length),
      );

      for (const rec of criterionSlice) {
        if (
          isSeen(rec.id, seenTmdbIds) ||
          isRawSeen(
            {
              title: rec.title,
              year: rec.release_date
                ? parseInt(rec.release_date.slice(0, 4), 10)
                : undefined,
            },
            seenRaw,
          )
        ) continue;

        const bonus = genrePref.name === topGenre ? 2 : 0;
        addCandidate(candidates, {
          ...searchResultFields(rec),
          score:
            CRITERION_DISCOVER_SCORE +
            bonus +
            artHouseBoost(signalsFromSearchResult(rec)) * 0.5,
          reason: "Criterion closet pick",
          genre: genrePref.name,
          tmdbSource: "criterion",
        });
      }

      for (const rec of indieSlice) {
        if (
          isSeen(rec.id, seenTmdbIds) ||
          isRawSeen(
            {
              title: rec.title,
              year: rec.release_date
                ? parseInt(rec.release_date.slice(0, 4), 10)
                : undefined,
            },
            seenRaw,
          )
        ) continue;

        addCandidate(candidates, {
          ...searchResultFields(rec),
          score:
            INDIE_DISCOVER_SCORE +
            artHouseBoost(signalsFromSearchResult(rec)) * 0.45,
          reason: `Critically acclaimed ${genrePref.name} indie`,
          genre: genrePref.name,
          tmdbSource: "discover",
        });
      }
    }),
  );

  for (const [directorIndex, directorPref] of discoverDirectorsForBlend(
    tasteProfile,
    hash,
  ).entries()) {
    const personId = await searchPersonId(directorPref.name);
    if (!personId) continue;

    const bonus = directorPref.name === topDirector ? 2.5 : 0;
    const results = await discoverMovies({
      personId,
      excludeIds,
      page: discoverPage + directorIndex + (hash % 3),
      artHouse: true,
      voteAverageMin: 7.0,
      voteCountMax: 2000,
    });

    const directorSlice = rotateSlice(
      results,
      (hash >> 4) + directorIndex,
      Math.min(6, results.length),
    );

    for (const rec of directorSlice) {
      const recYear = rec.release_date
        ? parseInt(rec.release_date.slice(0, 4), 10)
        : undefined;
      if (
        isSeen(rec.id, seenTmdbIds) ||
        candidates.has(rec.id) ||
        isRawSeen({ title: rec.title, year: recYear }, seenRaw)
      ) continue;

      const signals = signalsFromSearchResult(rec);
      if (!isArtHouseCandidate(signals)) continue;

      addCandidate(candidates, {
        ...searchResultFields(rec),
        score: DIRECTOR_DISCOVER_SCORE + bonus + artHouseBoost(signals) * 0.35,
        reason: `Art-house deep cut from ${directorPref.name}`,
        director: directorPref.name,
        tmdbSource: "discover",
      });
    }
  }
}

async function nicheBackfill(
  candidates: Map<number, ScoredCandidate>,
  tasteProfile: TasteProfile,
  seenTmdbIds: Set<number>,
  seenRaw: Set<string>,
  user1: ParticipantData,
  user2: ParticipantData,
  salt = "",
): Promise<void> {
  const chosenIds = new Set([...seenTmdbIds, ...candidates.keys()]);
  const exclude = Array.from(chosenIds);
  const hash = blendHash(user1, user2, salt);
  const startPage = blendDiscoverPage(user1, user2, salt);
  const genres = discoverGenresForBlend(tasteProfile, hash >> 1);

  for (let page = startPage; page <= startPage + BACKFILL_PAGE_BUDGET - 1; page += 1) {
    if (candidates.size >= TARGET * 3) return;

    for (const genrePref of genres) {
      const genreId = mapGenreToTmdbId(genrePref.name);
      if (!genreId) continue;

      const results = await discoverCriterionMovies({
        genreIds: [genreId],
        excludeIds: exclude,
        page,
      });

      for (const rec of results) {
        const recYear = rec.release_date
          ? parseInt(rec.release_date.slice(0, 4), 10)
          : undefined;
        if (
          isSeen(rec.id, seenTmdbIds) ||
          candidates.has(rec.id) ||
          isRawSeen({ title: rec.title, year: recYear }, seenRaw)
        ) continue;

        addCandidate(candidates, {
          ...searchResultFields(rec),
          score: 2 + artHouseBoost(signalsFromSearchResult(rec)) * 0.3,
          reason: `Criterion backfill · ${genrePref.name}`,
          genre: genrePref.name,
          tmdbSource: "criterion",
        });
        chosenIds.add(rec.id);
        exclude.push(rec.id);
        if (candidates.size >= TARGET * 3) return;
      }
    }
  }
}

async function buildTasteRecommendations(
  user1: ParticipantData,
  user2: ParticipantData,
  tasteProfile: TasteProfile,
  seenTmdbIds: Set<number>,
  seenFilms: LetterboxdFilm[],
  salt = "",
): Promise<RecommendedFilm[]> {
  if (!isTmdbConfigured()) return [];

  const excludeIds = Array.from(seenTmdbIds);
  const seenRaw = rawSeenKeys(seenFilms);
  const user1Genres = preferenceScoreMap(tasteProfile.user1TopGenres);
  const user2Genres = preferenceScoreMap(tasteProfile.user2TopGenres);
  const user1Directors = preferenceScoreMap(tasteProfile.user1TopDirectors);
  const user2Directors = preferenceScoreMap(tasteProfile.user2TopDirectors);
  const commonHighlyRated = intersectRatedFilms(
    user1.filmsRated,
    user2.filmsRated,
    user1.filmsWatched as EnrichedFilm[],
    user2.filmsWatched as EnrichedFilm[],
  );

  const seeds = await buildTasteSeeds(
    user1,
    user2,
    commonHighlyRated,
    tasteProfile.commonHighlyRated ?? [],
    salt,
  );
  if (seeds.length === 0) return [];

  const candidates = new Map<number, ScoredCandidate>();

  await Promise.all([
    expandFromSeeds(
      seeds,
      candidates,
      seenTmdbIds,
      seenRaw,
      excludeIds,
      user1,
      user2,
      salt,
    ),
    discoverArtHouseCatalog(
      candidates,
      tasteProfile,
      seenTmdbIds,
      seenRaw,
      excludeIds,
      user1,
      user2,
      salt,
    ),
  ]);

  let sorted = filterCandidates(candidates, seenTmdbIds);

  if (sorted.length < TARGET) {
    await nicheBackfill(
      candidates,
      tasteProfile,
      seenTmdbIds,
      seenRaw,
      user1,
      user2,
      salt,
    );
    sorted = filterCandidates(candidates, seenTmdbIds);
  }

  const rankPool = sorted.slice(0, RANK_POOL);
  const topGenre = tasteProfile.topSharedGenre?.name;
  const topDirector = tasteProfile.topSharedDirector?.name;

  const ranked: RankedCandidate[] = rankPool.map((candidate) => {
    const film = candidateToFilm(candidate);
    const fit = tasteFitScore(
      film,
      user1Genres,
      user2Genres,
      user1Directors,
      user2Directors,
    );
    const affinity = maxSeedAffinity(film, seeds);
    const niche = nicheAppeal(film.voteCount, film.popularity);
    const artHouse = artHouseBoost(signalsFromFilm(film));

    const catalogPenalty = isCatalogOnlyCandidate(candidate)
      ? CATALOG_ONLY_PENALTY
      : 0;

    const finalScore =
      candidate.score +
      fit * TASTE_FIT_WEIGHT +
      affinity * AFFINITY_WEIGHT +
      niche * NICHE_BONUS_WEIGHT +
      artHouse * ART_HOUSE_WEIGHT +
      candidate.seedConnections * SEED_CONNECTION_BONUS -
      catalogPenalty -
      mainstreamPenalty({
        ...candidate,
        voteCount: film.voteCount ?? candidate.voteCount,
        popularity: film.popularity ?? candidate.popularity,
      });

    return { candidate, film, finalScore };
  });

  ranked.sort((a, b) => b.finalScore - a.finalScore);
  const diversified = diversifyCandidates(ranked, TARGET);

  const enrichedFinal = await enrichFilmsBatch(
    diversified.map(({ candidate }) => ({
      slug: `tmdb-${candidate.tmdbId}`,
      title: candidate.title,
      year: candidate.year,
      tmdbId: candidate.tmdbId,
      posterPath: candidate.posterPath,
    })),
  );
  const enrichedByTmdbId = new Map(
    enrichedFinal
      .filter((film) => film.tmdbId)
      .map((film) => [film.tmdbId!, film] as const),
  );

  const enriched: RecommendedFilm[] = [];

  for (const [index, { candidate, film, finalScore }] of diversified.entries()) {
    if (
      isSeen(candidate.tmdbId, seenTmdbIds) ||
      isRawSeen({ title: candidate.title, year: candidate.year }, seenRaw)
    ) continue;

    const detailed =
      (candidate.tmdbId ? enrichedByTmdbId.get(candidate.tmdbId) : null) ?? film;

    const matchedGenres = Array.from(candidate.matchedGenres);
    const matchedDirectors = Array.from(candidate.matchedDirectors);

    if (
      topGenre &&
      (detailed.genres ?? []).some(
        (g) => normalizePreferenceName(g) === normalizePreferenceName(topGenre),
      )
    ) {
      matchedGenres.push(topGenre);
    }

    if (
      topDirector &&
      (detailed.directors ?? []).some(
        (d) =>
          normalizePreferenceName(d) === normalizePreferenceName(topDirector),
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
      seedConnections: candidate.seedConnections,
    });

    enriched.push({
      ...detailed,
      tmdbId: candidate.tmdbId,
      posterPath: detailed.posterPath ?? candidate.posterPath,
      rank,
      reason: Array.from(candidate.reasons).slice(0, 2).join(" · "),
      matchScore: Math.min(
        99,
        Math.max(
          38,
          Math.round(finalScore * 5.5 + 24 + candidate.seedConnections * 3),
        ),
      ),
      explanation,
    });
  }

  return enriched.filter(
    (film) =>
      (!film.tmdbId || !isSeen(film.tmdbId, seenTmdbIds)) &&
      !isRawSeen({ title: film.title, year: film.year }, seenRaw),
  );
}

export async function buildRecommendationBundle(
  user1: ParticipantData,
  user2: ParticipantData,
  tasteProfile: TasteProfile,
  seenTmdbIds: Set<number>,
  seenFilms: LetterboxdFilm[],
  salt = "",
): Promise<RecommendedFilm[]> {
  return buildTasteRecommendations(
    user1,
    user2,
    tasteProfile,
    seenTmdbIds,
    seenFilms,
    salt,
  );
}
