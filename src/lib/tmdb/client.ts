import type { EnrichedFilm, LetterboxdFilm } from "@/types/blend";
import { normalizeTitle } from "@/lib/blend/matching";
import { resolveTmdbFromLetterboxdSlug } from "@/lib/letterboxd/tmdb-link";
import {
  readFilmCache,
  readFilmCacheBatch,
  writeFilmCache,
} from "@/lib/tmdb/cache";

const TMDB_BASE = "https://api.themoviedb.org/3";

const TMDB_GENRE_IDS: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  "science fiction": 878,
  "sci fi": 878,
  "sci-fi": 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

interface TmdbSearchResult {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string | null;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  original_language?: string;
}

interface TmdbMovieDetails {
  id: number;
  title: string;
  runtime?: number | null;
  poster_path?: string | null;
  release_date?: string;
  overview?: string | null;
  popularity?: number;
  vote_count?: number;
  vote_average?: number;
  original_language?: string;
  genres?: { id: number; name: string }[];
  production_companies?: { id: number; name: string }[];
  credits?: {
    crew?: { job: string; name: string; id: number }[];
  };
}

interface TmdbTvDetails {
  id: number;
  name: string;
  poster_path?: string | null;
  first_air_date?: string;
  overview?: string | null;
  popularity?: number;
  vote_count?: number;
  episode_run_time?: number[];
  genres?: { id: number; name: string }[];
  credits?: {
    crew?: { job: string; name: string; id: number }[];
  };
}

type TmdbMediaDetails = TmdbMovieDetails | TmdbTvDetails;

interface TmdbDiscoverResult {
  results: TmdbSearchResult[];
}

export function isTmdbConfigured(): boolean {
  return Boolean(process.env.TMDB_API_KEY);
}

async function tmdbFetch<T>(path: string): Promise<T | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;

  const url = `${TMDB_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${key}`;
  const response = await fetch(url, { next: { revalidate: 86400 } });
  if (!response.ok) return null;
  return response.json() as Promise<T>;
}

export function mapGenreToTmdbId(genre: string): number | null {
  const key = genre.toLowerCase().trim();
  return TMDB_GENRE_IDS[key] ?? null;
}

async function findTmdbId(film: LetterboxdFilm): Promise<number | null> {
  const query = encodeURIComponent(film.title);
  const yearParam = film.year ? `&year=${film.year}` : "";
  const data = await tmdbFetch<{ results: TmdbSearchResult[] }>(
    `/search/movie?query=${query}${yearParam}`,
  );
  const results = data?.results ?? [];
  if (results.length === 0) return null;

  const normalizedQuery = normalizeTitle(film.title);
  const exactTitleMatches = results.filter(
    (result) => normalizeTitle(result.title) === normalizedQuery,
  );
  const pool = exactTitleMatches.length > 0 ? exactTitleMatches : results;

  if (film.year) {
    const yearMatch = pool.find(
      (result) =>
        result.release_date &&
        parseInt(result.release_date.slice(0, 4), 10) === film.year,
    );
    if (yearMatch) return yearMatch.id;
  }

  return pool[0].id;
}

async function getTmdbDetails(
  tmdbId: number,
  mediaType: "movie" | "tv",
): Promise<TmdbMediaDetails | null> {
  if (mediaType === "tv") {
    return tmdbFetch<TmdbTvDetails>(`/tv/${tmdbId}?append_to_response=credits`);
  }
  return getMovieDetails(tmdbId);
}

async function getMovieDetails(tmdbId: number): Promise<TmdbMovieDetails | null> {
  return tmdbFetch<TmdbMovieDetails>(
    `/movie/${tmdbId}?append_to_response=credits`,
  );
}

export async function enrichTmdbMovieById(
  tmdbId: number,
  film: LetterboxdFilm,
  mediaType: "movie" | "tv" = "movie",
): Promise<EnrichedFilm> {
  if (!isTmdbConfigured()) return { ...film, tmdbId };

  const details = await getTmdbDetails(tmdbId, mediaType);
  if (!details) return { ...film, tmdbId };

  return detailsToEnriched(film, tmdbId, details, mediaType);
}

async function resolveTmdbForFilm(
  film: LetterboxdFilm,
): Promise<{ tmdbId: number; mediaType: "movie" | "tv" } | null> {
  const fromLetterboxd = await resolveTmdbFromLetterboxdSlug(film.slug);
  if (fromLetterboxd) return fromLetterboxd;

  const tmdbId = await findTmdbId(film);
  if (!tmdbId) return null;

  return { tmdbId, mediaType: "movie" };
}

export async function enrichFilm(film: LetterboxdFilm): Promise<EnrichedFilm> {
  if (!isTmdbConfigured()) return { ...film };

  const cached = await readFilmCache(film.slug);
  if (cached?.tmdbId) {
    const fromLetterboxd = await resolveTmdbFromLetterboxdSlug(film.slug);
    if (!fromLetterboxd || fromLetterboxd.tmdbId === cached.tmdbId) {
      return { ...film, ...cached };
    }
  } else if (cached) {
    return { ...film, ...cached };
  }

  const resolved = await resolveTmdbForFilm(film);
  if (!resolved) return { ...film };

  const details = await getTmdbDetails(resolved.tmdbId, resolved.mediaType);
  if (!details) return { ...film, tmdbId: resolved.tmdbId };

  const enriched = detailsToEnriched(
    film,
    resolved.tmdbId,
    details,
    resolved.mediaType,
  );
  await writeFilmCache(enriched);
  return enriched;
}

function detailsToEnriched(
  film: LetterboxdFilm,
  tmdbId: number,
  details: TmdbMediaDetails,
  mediaType: "movie" | "tv",
): EnrichedFilm {
  const directors =
    details.credits?.crew
      ?.filter((c) => c.job === "Director")
      .map((c) => c.name) ?? [];

  const isMovie = mediaType === "movie";
  const movieDetails = isMovie ? (details as TmdbMovieDetails) : null;
  const tvDetails = isMovie ? null : (details as TmdbTvDetails);

  const releaseDate = isMovie
    ? movieDetails?.release_date
    : tvDetails?.first_air_date;
  const year = releaseDate
    ? parseInt(releaseDate.slice(0, 4), 10)
    : film.year;

  return {
    ...film,
    title: isMovie ? movieDetails!.title : tvDetails!.name,
    year,
    tmdbId,
    posterPath: details.poster_path,
    overview: details.overview ?? null,
    genres: details.genres?.map((g) => g.name) ?? [],
    directors,
    runtime: isMovie
      ? (movieDetails?.runtime ?? null)
      : (tvDetails?.episode_run_time?.[0] ?? null),
    popularity: details.popularity,
    voteCount: details.vote_count,
    voteAverage: isMovie ? movieDetails?.vote_average : undefined,
    originalLanguage: isMovie ? movieDetails?.original_language : undefined,
  };
}

async function enrichWithConcurrency(
  films: LetterboxdFilm[],
  concurrency = 10,
): Promise<EnrichedFilm[]> {
  const results: EnrichedFilm[] = new Array(films.length);
  let index = 0;

  async function worker() {
    while (index < films.length) {
      const current = index;
      index += 1;
      results[current] = await enrichFilm(films[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, films.length) }, () => worker()),
  );

  return results;
}

/** Enriches every film — no truncation. Uses cache + bounded concurrency. */
export async function enrichFilmsBatch(
  films: LetterboxdFilm[],
): Promise<EnrichedFilm[]> {
  if (films.length === 0) return [];
  if (!isTmdbConfigured()) return films.map((film) => ({ ...film }));

  const cache = await readFilmCacheBatch(films.map((f) => f.slug));
  const toFetch: LetterboxdFilm[] = [];
  const results: EnrichedFilm[] = films.map((film) => {
    const cached = cache.get(film.slug);
    if (cached) return { ...film, ...cached };
    toFetch.push(film);
    return { ...film };
  });

  if (toFetch.length === 0) return results;

  const fetched = await enrichWithConcurrency(toFetch);
  const fetchedMap = new Map(fetched.map((f) => [f.slug, f]));

  return films.map(
    (film) => fetchedMap.get(film.slug) ?? cache.get(film.slug) ?? { ...film },
  );
}

/** @deprecated Use enrichFilmsBatch — this no longer truncates when limit omitted. */
export async function enrichFilms(
  films: LetterboxdFilm[],
  limit?: number,
): Promise<EnrichedFilm[]> {
  const slice = limit ? films.slice(0, limit) : films;
  return enrichFilmsBatch(slice);
}

export async function searchPersonId(name: string): Promise<number | null> {
  const data = await tmdbFetch<{ results: { id: number; name: string }[] }>(
    `/search/person?query=${encodeURIComponent(name)}`,
  );
  return data?.results?.[0]?.id ?? null;
}

export async function discoverMovies(options: {
  genreIds?: number[];
  personId?: number;
  companyIds?: number[];
  keywordIds?: number[];
  excludeKeywordIds?: number[];
  excludeIds?: number[];
  page?: number;
  sortBy?: string;
  /** Bias toward under-the-radar titles with real ratings. */
  niche?: boolean;
  /** Festival / Criterion / indie lane — strict vote & acclaim filters. */
  artHouse?: boolean;
  voteCountMin?: number;
  voteCountMax?: number;
  voteAverageMin?: number;
}): Promise<TmdbSearchResult[]> {
  const artHouse = options.artHouse ?? false;
  const params = new URLSearchParams({
    sort_by: options.sortBy ?? (artHouse ? "vote_average.desc" : "vote_average.desc"),
    "vote_count.gte": String(
      options.voteCountMin ??
        (artHouse ? 40 : options.niche ? 100 : 200),
    ),
    include_adult: "false",
    page: String(options.page ?? 1),
  });

  if (artHouse) {
    params.set("vote_average.gte", String(options.voteAverageMin ?? 7.0));
    params.set("vote_count.lte", String(options.voteCountMax ?? 2500));
  } else if (options.niche || options.voteCountMax) {
    params.set(
      "vote_count.lte",
      String(options.voteCountMax ?? (options.niche ? 4000 : 50_000)),
    );
  }

  if (options.genreIds?.length) {
    params.set("with_genres", options.genreIds.join("|"));
  }

  if (options.personId) {
    params.set("with_crew", String(options.personId));
  }

  if (options.companyIds?.length) {
    params.set("with_companies", options.companyIds.join("|"));
  }

  if (options.keywordIds?.length) {
    params.set("with_keywords", options.keywordIds.join("|"));
  }

  if (options.excludeKeywordIds?.length) {
    params.set("without_keywords", options.excludeKeywordIds.join("|"));
  }

  const data = await tmdbFetch<TmdbDiscoverResult>(
    `/discover/movie?${params.toString()}`,
  );

  const exclude = new Set(options.excludeIds ?? []);
  let results = (data?.results ?? []).filter((m) => !exclude.has(m.id));

  if (artHouse) {
    results = results.filter(
      (movie) =>
        (movie.vote_average ?? 0) >= 6.8 &&
        (movie.popularity ?? 0) <= 28 &&
        (movie.vote_count ?? 0) <= 2800,
    );
    return results;
  }

  if (!options.niche) return results;

  return results.filter(
    (movie) => (movie.popularity ?? 0) <= 45 && (movie.vote_count ?? 0) <= 4500,
  );
}

export async function discoverCriterionMovies(options: {
  genreIds?: number[];
  excludeIds?: number[];
  page?: number;
}): Promise<TmdbSearchResult[]> {
  return discoverMovies({
    ...options,
    companyIds: [10932],
    artHouse: true,
    voteAverageMin: 6.9,
    voteCountMax: 2200,
  });
}

export async function discoverIndieMovies(options: {
  genreIds?: number[];
  excludeIds?: number[];
  page?: number;
}): Promise<TmdbSearchResult[]> {
  return discoverMovies({
    ...options,
    keywordIds: [9672, 12565],
    excludeKeywordIds: [9715, 9717],
    artHouse: true,
    voteAverageMin: 7.0,
    voteCountMax: 2000,
  });
}

export async function getMovieRecommendations(
  tmdbId: number,
  excludeIds: number[] = [],
): Promise<TmdbSearchResult[]> {
  const data = await tmdbFetch<{ results: TmdbSearchResult[] }>(
    `/movie/${tmdbId}/recommendations`,
  );
  const exclude = new Set(excludeIds);
  return (data?.results ?? []).filter((m) => !exclude.has(m.id));
}

export async function getSimilarMovies(
  tmdbId: number,
  excludeIds: number[] = [],
): Promise<TmdbSearchResult[]> {
  const data = await tmdbFetch<{ results: TmdbSearchResult[] }>(
    `/movie/${tmdbId}/similar`,
  );
  const exclude = new Set(excludeIds);
  return (data?.results ?? []).filter((m) => !exclude.has(m.id));
}

export function tmdbResultToEnriched(result: TmdbSearchResult): EnrichedFilm {
  const year = result.release_date
    ? parseInt(result.release_date.slice(0, 4), 10)
    : undefined;

  return {
    slug: `tmdb-${result.id}`,
    title: result.title,
    year,
    tmdbId: result.id,
    posterPath: result.poster_path,
    overview: result.overview ?? null,
    popularity: result.popularity,
    voteCount: result.vote_count,
    voteAverage: result.vote_average,
    originalLanguage: result.original_language,
  };
}

export function posterUrl(
  path: string | null | undefined,
  size = "w342",
): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export async function resolveExcludeTmdbIds(
  films: LetterboxdFilm[],
  cap = 300,
): Promise<number[]> {
  const enriched = await enrichFilmsBatch(films.slice(0, cap));
  const ids = new Set<number>();
  for (const film of enriched) {
    if (film.tmdbId) ids.add(film.tmdbId);
  }
  return Array.from(ids);
}
