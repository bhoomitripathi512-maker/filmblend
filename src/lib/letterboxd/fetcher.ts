import * as cheerio from "cheerio";
import type { DirectorStat, GenreStat, LetterboxdFilm, RatedFilm } from "@/types/blend";

const BASE_URL = "https://letterboxd.com";
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchHtml(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: FETCH_HEADERS,
    next: { revalidate: 3600 },
  });

  if (response.status === 404) {
    throw new LetterboxdError("User not found or profile is private", 404);
  }

  if (!response.ok) {
    throw new LetterboxdError(
      `Letterboxd request failed (${response.status})`,
      response.status,
    );
  }

  return response.text();
}

export class LetterboxdError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "LetterboxdError";
  }
}

function parseFilmsFromHtml(html: string): LetterboxdFilm[] {
  const $ = cheerio.load(html);
  const films: LetterboxdFilm[] = [];
  const seen = new Set<string>();

  $('a[href*="/film/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(/\/film\/([^/]+)\/?/);
    if (!match) return;

    const slug = match[1];
    if (seen.has(slug)) return;
    seen.add(slug);

    const imgAlt = $(el).find("img").attr("alt") ?? "";
    const text = $(el).text().trim();
    const label = imgAlt || text;
    const titleMatch = label.match(/^(.+?)(?:\s*\((\d{4})\))?$/);
    const title = titleMatch?.[1]?.trim() || slug.replace(/-/g, " ");
    const year = titleMatch?.[2] ? parseInt(titleMatch[2], 10) : undefined;

    films.push({ slug, title, year });
  });

  return films;
}

const HIGH_RATING_THRESHOLD = 4;

function parseRatingFromElement(
  $: cheerio.CheerioAPI,
  el: Parameters<cheerio.CheerioAPI>[0],
): number {
  const $el = $(el);
  const ownerRating = $el.attr("data-owner-rating");
  if (ownerRating) {
    return parseInt(ownerRating, 10) / 2;
  }

  const classAttr =
    $el.attr("class") ??
    $el.find("[class*='rated-']").first().attr("class") ??
    "";
  const ratedMatch = classAttr.match(/rated-(\d+)/);
  if (ratedMatch) {
    return parseInt(ratedMatch[1], 10) / 2;
  }

  const ratingText = $el.find(".rating").attr("class") ?? "";
  const textMatch = ratingText.match(/rated-(\d+)/);
  if (textMatch) {
    return parseInt(textMatch[1], 10) / 2;
  }

  return 0;
}

function parseRatedFilmsFromHtml(html: string): RatedFilm[] {
  const $ = cheerio.load(html);
  const films: RatedFilm[] = [];
  const seen = new Set<string>();

  $(
    "li.poster-container, div.poster-container, div.film-poster, li.grid-item",
  ).each((_, el) => {
    const $el = $(el);
    const link = $el.find('a[href*="/film/"]').first();
    const href = link.attr("href") ?? $el.attr("href") ?? "";
    const match = href.match(/\/film\/([^/]+)\/?/);
    if (!match) return;

    const slug = match[1];
    if (seen.has(slug)) return;
    seen.add(slug);

    const rating = parseRatingFromElement($, el);
    if (rating <= 0) return;

    const imgAlt = link.find("img").attr("alt") ?? "";
    const label = imgAlt || link.text().trim();
    const titleMatch = label.match(/^(.+?)(?:\s*\((\d{4})\))?$/);
    const title = titleMatch?.[1]?.trim() || slug.replace(/-/g, " ");
    const year = titleMatch?.[2] ? parseInt(titleMatch[2], 10) : undefined;

    films.push({ slug, title, year, rating });
  });

  if (films.length === 0) {
    for (const film of parseFilmsFromHtml(html)) {
      if (!seen.has(film.slug)) {
        films.push({ ...film, rating: HIGH_RATING_THRESHOLD });
      }
    }
  }

  return films.sort((a, b) => b.rating - a.rating);
}

function getPageCount(html: string): number {
  const $ = cheerio.load(html);
  let maxPage = 1;

  $(".paginate-pages a, .pagination li a").each((_, el) => {
    const page = parseInt($(el).text().trim(), 10);
    if (!Number.isNaN(page) && page > maxPage) {
      maxPage = page;
    }
  });

  return maxPage;
}

async function fetchAllPages(
  basePath: string,
  maxPages = 50,
): Promise<LetterboxdFilm[]> {
  const firstHtml = await fetchHtml(basePath);
  const pageCount = Math.min(getPageCount(firstHtml), maxPages);
  const allFilms = parseFilmsFromHtml(firstHtml);

  for (let page = 2; page <= pageCount; page += 1) {
    const separator = basePath.includes("?") ? "&" : "?";
    const html = await fetchHtml(`${basePath}${separator}page=${page}`);
    allFilms.push(...parseFilmsFromHtml(html));
  }

  const unique = new Map<string, LetterboxdFilm>();
  for (const film of allFilms) {
    unique.set(film.slug, film);
  }
  return Array.from(unique.values());
}

export async function verifyLetterboxdUser(username: string): Promise<{
  username: string;
  displayName: string;
  avatarUrl: string | null;
}> {
  const normalized = username.trim().toLowerCase().replace(/^@/, "");
  const html = await fetchHtml(`/${normalized}/`);
  const $ = cheerio.load(html);

  const displayName =
    $(".profile-name h1").first().text().trim() ||
    $(".profile-header h1").first().text().trim() ||
    normalized;

  const avatarUrl =
    $(".avatar img").attr("src") ??
    $(".profile-avatar img").attr("src") ??
    null;

  return { username: normalized, displayName, avatarUrl };
}

export async function fetchUserWatchlist(
  username: string,
): Promise<LetterboxdFilm[]> {
  const normalized = username.trim().toLowerCase().replace(/^@/, "");
  return fetchAllPages(`/${normalized}/watchlist/`);
}

export async function fetchUserWatchedFilms(
  username: string,
): Promise<LetterboxdFilm[]> {
  const normalized = username.trim().toLowerCase().replace(/^@/, "");
  return fetchAllPages(`/${normalized}/films/`);
}

export async function fetchUserRatedFilms(
  username: string,
): Promise<RatedFilm[]> {
  const normalized = username.trim().toLowerCase().replace(/^@/, "");
  const firstHtml = await fetchHtml(`/${normalized}/films/ratings/`);
  const pageCount = Math.min(getPageCount(firstHtml), 30);
  const allRated = parseRatedFilmsFromHtml(firstHtml);

  for (let page = 2; page <= pageCount; page += 1) {
    const html = await fetchHtml(
      `/${normalized}/films/ratings/page/${page}/`,
    );
    allRated.push(...parseRatedFilmsFromHtml(html));
  }

  const unique = new Map<string, RatedFilm>();
  for (const film of allRated) {
    unique.set(film.slug, film);
  }

  return Array.from(unique.values()).sort((a, b) => b.rating - a.rating);
}

export async function fetchUserGenreStats(
  username: string,
): Promise<GenreStat[]> {
  const normalized = username.trim().toLowerCase().replace(/^@/, "");
  const html = await fetchHtml(`/${normalized}/films/genres/`);
  const $ = cheerio.load(html);
  const stats: GenreStat[] = [];

  $("a[href*='/films/genre/']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const genreMatch = href.match(/\/genre\/([^/]+)/);
    if (!genreMatch) return;

    const genre = genreMatch[1].replace(/-/g, " ");
    const countText =
      $(el).find(".value").text().trim() ||
      $(el).parent().find(".value").text().trim() ||
      $(el).text().match(/(\d+)/)?.[1] ||
      "0";
    const count = parseInt(countText, 10) || 0;
    if (count > 0) {
      stats.push({ genre, count, percentage: 0 });
    }
  });

  const total = stats.reduce((sum, s) => sum + s.count, 0);
  return stats
    .map((s) => ({
      ...s,
      percentage: total > 0 ? Math.round((s.count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function fetchUserDirectorStats(
  username: string,
): Promise<DirectorStat[]> {
  const normalized = username.trim().toLowerCase().replace(/^@/, "");
  const html = await fetchHtml(`/${normalized}/films/directors/`);
  const $ = cheerio.load(html);
  const stats: DirectorStat[] = [];

  $("a[href*='/director/']").each((_, el) => {
    const director =
      $(el).find(".name").text().trim() ||
      $(el).text().trim().replace(/\d+$/, "").trim();
    const countText =
      $(el).find(".value").text().trim() ||
      $(el).parent().find(".value").text().trim() ||
      "0";
    const count = parseInt(countText, 10) || 0;

    if (director && count > 0) {
      stats.push({ director, count });
    }
  });

  return stats.sort((a, b) => b.count - a.count).slice(0, 20);
}

export async function syncLetterboxdUser(username: string) {
  const profile = await verifyLetterboxdUser(username);

  const [filmsWatchlist, filmsWatched, filmsRated, genreStats, directorStats] =
    await Promise.all([
      fetchUserWatchlist(profile.username),
      fetchUserWatchedFilms(profile.username),
      fetchUserRatedFilms(profile.username),
      fetchUserGenreStats(profile.username),
      fetchUserDirectorStats(profile.username),
    ]);

  return {
    ...profile,
    filmsWatchlist,
    filmsWatched,
    filmsRated,
    genreStats,
    directorStats,
    syncedAt: new Date().toISOString(),
  };
}
