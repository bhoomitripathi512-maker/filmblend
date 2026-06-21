import type {
  EnrichedFilm,
  LetterboxdFilm,
  ParticipantData,
  RatedFilm,
  TasteProfile,
  WeightedPreference,
} from "@/types/blend";
import {
  intersectFilmsRobust,
  normalizeSlug,
  normalizeTitle,
} from "@/lib/blend/matching";
import { enrichFilmsBatch } from "@/lib/tmdb/client";

/** Unrated watched films contribute at neutral midpoint. */
export const DEFAULT_UNRATED = 3;
/** Frequency nudges ranking without overpowering star ratings. */
export const COUNT_BONUS = 0.25;
export const TASTE_ENRICH_LIMIT = 80;

const GENRE_ALIASES: Record<string, string> = {
  "sci fi": "science fiction",
  "sci-fi": "science fiction",
  scifi: "science fiction",
};

export function normalizePreferenceName(name: string): string {
  const key = name.toLowerCase().trim();
  return GENRE_ALIASES[key] ?? key;
}

function ratingMap(user: ParticipantData): Map<string, number> {
  return new Map(user.filmsRated.map((f) => [f.slug, f.rating]));
}

function filmWeight(slug: string, ratings: Map<string, number>): number {
  return ratings.get(slug) ?? DEFAULT_UNRATED;
}

interface Bucket {
  score: number;
  count: number;
  ratingSum: number;
}

function addToBucket(
  buckets: Map<string, Bucket>,
  name: string,
  weight: number,
) {
  const key = normalizePreferenceName(name);
  const existing = buckets.get(key) ?? { score: 0, count: 0, ratingSum: 0 };
  existing.score += weight;
  existing.count += 1;
  existing.ratingSum += weight;
  buckets.set(key, existing);
}

function bucketsToRanked(
  buckets: Map<string, Bucket>,
  displayNames: Map<string, string>,
): WeightedPreference[] {
  const items = Array.from(buckets.entries())
    .map(([key, bucket]) => ({
      name: displayNames.get(key) ?? key,
      score: bucket.score + bucket.count * COUNT_BONUS,
      count: bucket.count,
      avgRating: bucket.count > 0 ? bucket.ratingSum / bucket.count : 0,
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count);

  return items.map((item, index) => ({ ...item, rank: index + 1 }));
}

function distillUserPreferences(
  enriched: EnrichedFilm[],
  ratings: Map<string, number>,
): {
  genres: WeightedPreference[];
  directors: WeightedPreference[];
} {
  const genreBuckets = new Map<string, Bucket>();
  const directorBuckets = new Map<string, Bucket>();
  const genreDisplay = new Map<string, string>();
  const directorDisplay = new Map<string, string>();

  for (const film of enriched) {
    const weight = filmWeight(film.slug, ratings);
    for (const genre of film.genres ?? []) {
      const key = normalizePreferenceName(genre);
      genreDisplay.set(key, genre);
      addToBucket(genreBuckets, genre, weight);
    }
    for (const director of film.directors ?? []) {
      const key = normalizePreferenceName(director);
      directorDisplay.set(key, director);
      addToBucket(directorBuckets, director, weight);
    }
  }

  return {
    genres: bucketsToRanked(genreBuckets, genreDisplay),
    directors: bucketsToRanked(directorBuckets, directorDisplay),
  };
}

function sharedPreferences(
  a: WeightedPreference[],
  b: WeightedPreference[],
): WeightedPreference[] {
  const bMap = new Map(
    b.map((item) => [normalizePreferenceName(item.name), item]),
  );

  const shared: WeightedPreference[] = [];

  for (const itemA of a) {
    const key = normalizePreferenceName(itemA.name);
    const itemB = bMap.get(key);
    if (!itemB) continue;

    shared.push({
      name: itemA.name,
      score: itemA.score + itemB.score,
      count: itemA.count + itemB.count,
      avgRating: (itemA.avgRating + itemB.avgRating) / 2,
      rank: Math.round((itemA.rank + itemB.rank) / 2),
      user1Rank: itemA.rank,
      user2Rank: itemB.rank,
    });
  }

  return shared.sort(
    (x, y) => y.score - x.score || x.rank - y.rank,
  );
}

function uniqueEnrichedBySlug(films: EnrichedFilm[]): EnrichedFilm[] {
  const map = new Map<string, EnrichedFilm>();
  for (const film of films) {
    map.set(normalizeSlug(film.slug), film);
  }
  return Array.from(map.values());
}

function lookupRatedFilm(
  canonical: LetterboxdFilm,
  rated: RatedFilm[],
  enriched: EnrichedFilm[],
): RatedFilm | undefined {
  const slug = normalizeSlug(canonical.slug);
  const bySlug = rated.find((film) => normalizeSlug(film.slug) === slug);
  if (bySlug) return bySlug;

  if (canonical.year) {
    const key = `${normalizeTitle(canonical.title)}|${canonical.year}`;
    const byTitleYear = rated.find(
      (film) =>
        film.year &&
        `${normalizeTitle(film.title)}|${film.year}` === key,
    );
    if (byTitleYear) return byTitleYear;
  }

  const canonicalEnriched = enriched.find(
    (film) => normalizeSlug(film.slug) === slug,
  );
  if (canonicalEnriched?.tmdbId) {
    for (const film of enriched) {
      if (film.tmdbId !== canonicalEnriched.tmdbId) continue;
      const match = rated.find(
        (candidate) => normalizeSlug(candidate.slug) === normalizeSlug(film.slug),
      );
      if (match) return match;
    }
  }

  return undefined;
}

export function intersectRatedFilms(
  a: RatedFilm[],
  b: RatedFilm[],
  aEnriched: EnrichedFilm[] = [],
  bEnriched: EnrichedFilm[] = [],
  minRating = 4,
): RatedFilm[] {
  const aRated = a.filter((film) => film.rating >= minRating);
  const bRated = b.filter((film) => film.rating >= minRating);
  const matches = intersectFilmsRobust(aRated, bRated, aEnriched, bEnriched);

  const results: RatedFilm[] = [];

  for (const match of matches) {
    const filmA = lookupRatedFilm(match, aRated, aEnriched);
    const filmB = lookupRatedFilm(match, bRated, bEnriched);
    if (!filmA || !filmB) continue;

    results.push({
      ...match,
      rating: Math.max(filmA.rating, filmB.rating),
    });
  }

  return results.sort((x, y) => y.rating - x.rating);
}

export async function buildTasteProfile(
  user1: ParticipantData,
  user2: ParticipantData,
  enrichedWatched?: { user1: EnrichedFilm[]; user2: EnrichedFilm[] },
): Promise<TasteProfile> {
  const ratings1 = ratingMap(user1);
  const ratings2 = ratingMap(user2);

  const [enriched1, enriched2, ratedEnriched1, ratedEnriched2] =
    enrichedWatched
      ? await Promise.all([
          Promise.resolve(enrichedWatched.user1),
          Promise.resolve(enrichedWatched.user2),
          enrichFilmsBatch(user1.filmsRated),
          enrichFilmsBatch(user2.filmsRated),
        ])
      : await Promise.all([
          enrichFilmsBatch(user1.filmsWatched.slice(0, TASTE_ENRICH_LIMIT)),
          enrichFilmsBatch(user2.filmsWatched.slice(0, TASTE_ENRICH_LIMIT)),
          enrichFilmsBatch(user1.filmsRated),
          enrichFilmsBatch(user2.filmsRated),
        ]);

  const allEnriched1 = uniqueEnrichedBySlug([...enriched1, ...ratedEnriched1]);
  const allEnriched2 = uniqueEnrichedBySlug([...enriched2, ...ratedEnriched2]);

  const prefs1 = distillUserPreferences(enriched1, ratings1);
  const prefs2 = distillUserPreferences(enriched2, ratings2);

  const sharedGenresRanked = sharedPreferences(prefs1.genres, prefs2.genres);
  const sharedDirectorsRanked = sharedPreferences(
    prefs1.directors,
    prefs2.directors,
  );

  const commonHighlyRatedRaw = intersectRatedFilms(
    user1.filmsRated,
    user2.filmsRated,
    allEnriched1,
    allEnriched2,
  );
  const commonHighlyRated = await enrichFilmsBatch(
    commonHighlyRatedRaw.slice(0, 12),
  );

  const enrichedCount = enriched1.length + enriched2.length;
  const totalWatched = user1.filmsWatched.length + user2.filmsWatched.length;

  return {
    topSharedGenre: sharedGenresRanked[0] ?? null,
    topSharedDirector: sharedDirectorsRanked[0] ?? null,
    sharedGenresRanked,
    sharedDirectorsRanked,
    user1TopGenres: prefs1.genres.slice(0, 10),
    user2TopGenres: prefs2.genres.slice(0, 10),
    user1TopDirectors: prefs1.directors.slice(0, 10),
    user2TopDirectors: prefs2.directors.slice(0, 10),
    commonHighlyRated,
    enrichmentCoverage: { enriched: enrichedCount, total: totalWatched },
    sharedGenres: sharedGenresRanked.map((g) => g.name),
    sharedDirectors: sharedDirectorsRanked.map((d) => d.name),
  };
}

export function genreOverlapFromTaste(taste: TasteProfile): number {
  const shared = taste.sharedGenresRanked.length;
  if (shared === 0) return 0;
  return Math.min(100, Math.round((shared / 10) * 100));
}

export function weightedToGenreStats(
  prefs: WeightedPreference[],
): { genre: string; count: number; percentage: number }[] {
  const total = prefs.reduce((sum, p) => sum + p.count, 0) || 1;
  return prefs.slice(0, 5).map((p) => ({
    genre: p.name,
    count: p.count,
    percentage: Math.round((p.count / total) * 100),
  }));
}
