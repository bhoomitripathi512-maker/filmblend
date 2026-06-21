import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { EnrichedFilm, LetterboxdFilm } from "@/types/blend";

interface CacheRow {
  letterboxd_slug: string;
  title: string | null;
  year: number | null;
  tmdb_id: number | null;
  poster_path: string | null;
  genres: string[] | null;
  directors: string[] | null;
  runtime: number | null;
}

export async function readFilmCache(
  slug: string,
): Promise<EnrichedFilm | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("film_cache")
      .select("*")
      .eq("letterboxd_slug", slug)
      .maybeSingle();

    if (!data?.tmdb_id) return null;

    const row = data as CacheRow;
    return {
      slug: row.letterboxd_slug,
      title: row.title ?? slug,
      year: row.year ?? undefined,
      tmdbId: row.tmdb_id ?? undefined,
      posterPath: row.poster_path,
      genres: row.genres ?? [],
      directors: row.directors ?? [],
      runtime: row.runtime,
    };
  } catch {
    return null;
  }
}

export async function writeFilmCache(film: EnrichedFilm): Promise<void> {
  if (!isSupabaseConfigured() || !film.tmdbId) return;

  try {
    const supabase = createAdminClient();
    await supabase.from("film_cache").upsert({
      letterboxd_slug: film.slug,
      title: film.title,
      year: film.year ?? null,
      tmdb_id: film.tmdbId,
      poster_path: film.posterPath ?? null,
      genres: film.genres ?? [],
      directors: film.directors ?? [],
      runtime: film.runtime ?? null,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Cache writes are best-effort.
  }
}

export async function readFilmCacheBatch(
  slugs: string[],
): Promise<Map<string, EnrichedFilm>> {
  const map = new Map<string, EnrichedFilm>();
  if (!isSupabaseConfigured() || slugs.length === 0) return map;

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("film_cache")
      .select("*")
      .in("letterboxd_slug", slugs);

    for (const row of (data ?? []) as CacheRow[]) {
      if (!row.tmdb_id) continue;
      map.set(row.letterboxd_slug, {
        slug: row.letterboxd_slug,
        title: row.title ?? row.letterboxd_slug,
        year: row.year ?? undefined,
        tmdbId: row.tmdb_id ?? undefined,
        posterPath: row.poster_path,
        genres: row.genres ?? [],
        directors: row.directors ?? [],
        runtime: row.runtime,
      });
    }
  } catch {
    // ignore
  }

  return map;
}

export function cacheRowFromFilm(film: LetterboxdFilm & EnrichedFilm): CacheRow {
  return {
    letterboxd_slug: film.slug,
    title: film.title,
    year: film.year ?? null,
    tmdb_id: film.tmdbId ?? null,
    poster_path: film.posterPath ?? null,
    genres: film.genres ?? [],
    directors: film.directors ?? [],
    runtime: film.runtime ?? null,
  };
}
