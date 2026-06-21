import type { EnrichedFilm, LetterboxdFilm } from "@/types/blend";

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
  vote_average?: number;
}

interface TmdbMovieDetails {
  id: number;
  title: string;
  runtime?: number | null;
  poster_path?: string | null;
  release_date?: string;
  genres?: { id: number; name: string }[];
  credits?: {
    crew?: { job: string; name: string; id: number }[];
  };
}

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
  return data?.results?.[0]?.id ?? null;
}

async function getMovieDetails(tmdbId: number): Promise<TmdbMovieDetails | null> {
  return tmdbFetch<TmdbMovieDetails>(
    `/movie/${tmdbId}?append_to_response=credits`,
  );
}

export async function enrichFilm(film: LetterboxdFilm): Promise<EnrichedFilm> {
  if (!isTmdbConfigured()) return { ...film };

  const tmdbId = await findTmdbId(film);
  if (!tmdbId) return { ...film };

  const details = await getMovieDetails(tmdbId);
  if (!details) return { ...film, tmdbId };

  const directors =
    details.credits?.crew
      ?.filter((c) => c.job === "Director")
      .map((c) => c.name) ?? [];

  const year = details.release_date
    ? parseInt(details.release_date.slice(0, 4), 10)
    : film.year;

  return {
    ...film,
    year,
    tmdbId,
    posterPath: details.poster_path,
    genres: details.genres?.map((g) => g.name) ?? [],
    directors,
    runtime: details.runtime ?? null,
  };
}

export async function enrichFilms(
  films: LetterboxdFilm[],
  limit = 30,
): Promise<EnrichedFilm[]> {
  const slice = films.slice(0, limit);
  return Promise.all(slice.map(enrichFilm));
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
  excludeIds?: number[];
  page?: number;
}): Promise<TmdbSearchResult[]> {
  const params = new URLSearchParams({
    sort_by: "vote_average.desc",
    "vote_count.gte": "200",
    include_adult: "false",
    page: String(options.page ?? 1),
  });

  if (options.genreIds?.length) {
    params.set("with_genres", options.genreIds.join("|"));
  }

  if (options.personId) {
    params.set("with_crew", String(options.personId));
  }

  const data = await tmdbFetch<TmdbDiscoverResult>(
    `/discover/movie?${params.toString()}`,
  );

  const exclude = new Set(options.excludeIds ?? []);
  return (data?.results ?? []).filter((m) => !exclude.has(m.id));
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
  };
}

export function posterUrl(
  path: string | null | undefined,
  size = "w342",
): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
