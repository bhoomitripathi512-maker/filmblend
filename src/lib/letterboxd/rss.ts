import type { LetterboxdFilm, RatedFilm } from "@/types/blend";

const BASE_URL = "https://letterboxd.com";

function slugFromFilmLink(link: string): string | null {
  const match = link.match(/\/film\/([^/]+)\/?/);
  return match?.[1] ?? null;
}

function parseRssFilms(xml: string): RatedFilm[] {
  const films: RatedFilm[] = [];
  const seen = new Set<string>();

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const item = itemMatch[1];
    const link = item.match(/<link>([^<]+)<\/link>/)?.[1] ?? "";
    const slug = slugFromFilmLink(link);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const title =
      item.match(/<letterboxd:filmTitle>([^<]+)<\/letterboxd:filmTitle>/)?.[1] ??
      item.match(/<title>([^<]+)<\/title>/)?.[1]?.split(",")[0]?.trim() ??
      slug.replace(/-/g, " ");

    const yearText = item.match(
      /<letterboxd:filmYear>(\d{4})<\/letterboxd:filmYear>/,
    )?.[1];
    const year = yearText ? parseInt(yearText, 10) : undefined;

    const ratingText = item.match(
      /<letterboxd:memberRating>([\d.]+)<\/letterboxd:memberRating>/,
    )?.[1];
    const rating = ratingText ? parseFloat(ratingText) : 0;

    films.push({ slug, title, year, rating });
  }

  return films;
}

async function fetchRss(path: string): Promise<string> {
  const url = `${BASE_URL}${path}`;
  const proxyBase = process.env.LETTERBOXD_PROXY_URL?.replace(/\/$/, "");

  const response = proxyBase
    ? await fetch(`${proxyBase}?url=${encodeURIComponent(url)}`, {
        cache: "no-store",
      })
    : await fetch(url, {
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml, */*",
          "User-Agent": "Filmblend/1.0 (+https://filmblend.vercel.app)",
        },
        cache: "no-store",
      });

  if (response.status === 404) {
    throw new Error("User not found");
  }

  if (!response.ok) {
    throw new Error(`RSS request failed (${response.status})`);
  }

  const text = await response.text();
  if (!text.includes("<rss") && !text.includes("<feed") && !text.includes("<item>")) {
    throw new Error("RSS request blocked");
  }

  return text;
}

export async function fetchWatchlistFromRss(
  username: string,
): Promise<LetterboxdFilm[]> {
  const normalized = username.trim().toLowerCase().replace(/^@/, "");
  const xml = await fetchRss(`/${normalized}/watchlist/rss/`);
  const rated = parseRssFilms(xml);
  return rated.map(({ slug, title, year }) => ({ slug, title, year }));
}

export async function fetchUserFromRss(username: string): Promise<{
  username: string;
  displayName: string;
  filmsWatched: LetterboxdFilm[];
  filmsRated: RatedFilm[];
}> {
  const normalized = username.trim().toLowerCase().replace(/^@/, "");
  const xml = await fetchRss(`/${normalized}/rss/`);
  const filmsRated = parseRssFilms(xml);

  const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
  const displayName =
    titleMatch?.[1]?.replace(/^Letterboxd - /, "").trim() ?? normalized;

  const filmsWatched: LetterboxdFilm[] = filmsRated.map(
    ({ slug, title, year }) => ({ slug, title, year }),
  );

  return {
    username: normalized,
    displayName,
    filmsWatched,
    filmsRated,
  };
}

export async function verifyUserExistsViaRss(username: string): Promise<boolean> {
  try {
    await fetchRss(`/${username.trim().toLowerCase().replace(/^@/, "")}/rss/`);
    return true;
  } catch {
    return false;
  }
}
