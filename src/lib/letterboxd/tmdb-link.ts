import { fetchHtml } from "@/lib/letterboxd/fetcher";

const TMDB_LINK = /themoviedb\.org\/(movie|tv)\/(\d+)/;

export type LetterboxdTmdbLink = {
  tmdbId: number;
  mediaType: "movie" | "tv";
};

export async function resolveTmdbFromLetterboxdSlug(
  slug: string,
): Promise<LetterboxdTmdbLink | null> {
  const normalized = slug.trim().toLowerCase().replace(/^@/, "").replace(/\/+$/, "");
  if (!normalized) return null;

  try {
    const html = await fetchHtml(`/film/${normalized}/`);
    const match = html.match(TMDB_LINK);
    if (!match) return null;

    return {
      mediaType: match[1] === "tv" ? "tv" : "movie",
      tmdbId: parseInt(match[2], 10),
    };
  } catch {
    return null;
  }
}
