import * as cheerio from "cheerio";
import { fetchViaProxy, isNetworkFetchError, letterboxdProxyBase } from "@/lib/letterboxd/request";
import { fetchUserFromRss, fetchWatchlistFromRss } from "@/lib/letterboxd/rss";
import { uniqueFilms } from "@/lib/blend/matching";
import type { DirectorStat, GenreStat, LetterboxdFilm, RatedFilm } from "@/types/blend";
import type { ImpitResponse, RequestInit as ImpitRequestInit } from "impit";

const BASE_URL = "https://letterboxd.com";

/** Hard ceiling for watched /films/ pages to scrape per profile. */
export const WATCHED_FILMS_MAX_PAGES = 30;

interface ImpitClient {
  fetch(resource: string | URL | Request, init?: ImpitRequestInit): Promise<ImpitResponse>;
}

let impitClientPromise: Promise<ImpitClient> | null = null;

async function getImpitClient(): Promise<ImpitClient> {
  if (!impitClientPromise) {
    impitClientPromise = import("impit").then(({ Impit }) =>
      new Impit({ browser: "chrome" }),
    );
  }

  return impitClientPromise;
}

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
};

export function isCloudflareChallengeHtml(html: string): boolean {
  const hasLetterboxdContent =
    html.includes("data-item-slug") ||
    html.includes("data-film-slug") ||
    html.includes("poster-container") ||
    html.includes("profile-name") ||
    html.includes("profile-header") ||
    html.includes("/film/");

  if (hasLetterboxdContent) {
    return false;
  }

  return (
    html.includes("<title>Just a moment") ||
    html.includes("cf-chl-opt") ||
    html.includes("cf-browser-verification") ||
    html.includes("/cdn-cgi/challenge-platform") ||
    html.includes("challenge-form")
  );
}

function parseLetterboxdStars(line: string): number {
  let rating = 0;

  for (const char of line.trim()) {
    if (char === "★") rating += 1;
    if (char === "½") rating += 0.5;
  }

  return rating;
}

function titleYearFromLabel(label: string): {
  title: string;
  year?: number;
} {
  const titleMatch = label.match(/^(.+?)(?:\s*\((\d{4})\))?$/);
  return {
    title: titleMatch?.[1]?.trim() || label.trim(),
    year: titleMatch?.[2] ? parseInt(titleMatch[2], 10) : undefined,
  };
}

function parseFilmsFromMirrorMarkdown(markdown: string): {
  films: LetterboxdFilm[];
  ratings: RatedFilm[];
} {
  const films: LetterboxdFilm[] = [];
  const ratings: RatedFilm[] = [];
  const seen = new Set<string>();
  const itemRegex =
    /!\[Image[^\]]*\]\([^)]+\)\[([^\]]+)\]\(https:\/\/letterboxd\.com\/film\/([^/)]+)\/?\)/g;
  const matches = Array.from(markdown.matchAll(itemRegex));

  for (const [index, match] of matches.entries()) {
    const [, label, slug] = match;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const { title, year } = titleYearFromLabel(label);
    films.push({ slug, title, year });

    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    const tail = markdown.slice(start, end);
    const stars = tail.match(/[★½]+/)?.[0] ?? "";
    const rating = parseLetterboxdStars(stars);
    if (rating > 0) {
      ratings.push({ slug, title, year, rating });
    }
  }

  return { films, ratings };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchHtml(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const proxyBase = letterboxdProxyBase();

  if (proxyBase) {
    try {
      const response = await fetchViaProxy(
        proxyBase,
        url,
        { headers: { Accept: "text/html,application/xhtml+xml,*/*" } },
      );

      if (response.status === 404) {
        throw new LetterboxdError("User not found or profile is private", 404);
      }

      const text = await response.text();

      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          console.warn(
            `Letterboxd proxy returned ${response.status}, falling back to direct scraping:`,
            url,
          );
          return fetchHtmlDirect(url);
        }

        throw new LetterboxdError(
          `Letterboxd request failed (${response.status})`,
          response.status,
        );
      }

      if (isCloudflareChallengeHtml(text)) {
        console.warn(
          "Letterboxd proxy returned Cloudflare challenge, falling back to direct scraping:",
          url,
        );
        return fetchHtmlDirect(url);
      }

      return text;
    } catch (error) {
      if (error instanceof LetterboxdError) throw error;
      if (!isNetworkFetchError(error)) throw error;

      console.warn(
        "Letterboxd proxy unavailable, falling back to direct scraping:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return fetchHtmlDirect(url);
}

async function fetchHtmlDirect(url: string): Promise<string> {
  const browserResponse = await fetch(url, {
    headers: BROWSER_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const browserText = await browserResponse.text();

  if (browserResponse.status === 404) {
    throw new LetterboxdError("User not found or profile is private", 404);
  }

  if (browserResponse.ok && !isCloudflareChallengeHtml(browserText)) {
    return browserText;
  }

  const impit = await getImpitClient();

  try {
    const response = await impit.fetch(url, {
      headers: {
        accept: BROWSER_HEADERS.accept,
        "accept-language": BROWSER_HEADERS["accept-language"],
      },
    });
    const text = await response.text();

    if (response.status === 404) {
      throw new LetterboxdError("User not found or profile is private", 404);
    }

    if (response.ok && !isCloudflareChallengeHtml(text)) {
      return text;
    }

    if (!response.ok) {
      throw new LetterboxdError(
        `Letterboxd request failed (${response.status})`,
        response.status,
      );
    }

    throw new LetterboxdError(
      "Letterboxd blocked the request. Make sure your profile and watchlist are public, then try again.",
      403,
    );
  } catch (error) {
    if (error instanceof LetterboxdError) throw error;

    const statusCode =
      error &&
      typeof error === "object" &&
      "response" in error &&
      error.response &&
      typeof error.response === "object" &&
      "status" in error.response
        ? (error.response.status as number)
        : 0;

    if (statusCode === 404) {
      throw new LetterboxdError("User not found or profile is private", 404);
    }

    if (statusCode === 403) {
      throw new LetterboxdError(
        "Letterboxd blocked the request. Make sure your profile and watchlist are public, then try again.",
        403,
      );
    }

    if (browserResponse.ok && !isCloudflareChallengeHtml(browserText)) {
      return browserText;
    }

    throw new LetterboxdError(
      statusCode
        ? `Letterboxd request failed (${statusCode})`
        : "Could not reach Letterboxd. Please try again.",
      statusCode || 502,
    );
  }
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

  function addFilm(slug: string, title?: string, year?: number) {
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    films.push({
      slug,
      title: title?.trim() || slug.replace(/-/g, " "),
      year,
    });
  }

  $("[data-item-slug]").each((_, el) => {
    const slug = $(el).attr("data-item-slug") ?? "";
    const name = $(el).attr("data-item-name") ?? "";
    const titleMatch = name.match(/^(.+?)(?:\s*\((\d{4})\))?$/);
    addFilm(
      slug,
      titleMatch?.[1],
      titleMatch?.[2] ? parseInt(titleMatch[2], 10) : undefined,
    );
  });

  $("[data-film-slug]").each((_, el) => {
    const slug = $(el).attr("data-film-slug") ?? "";
    addFilm(slug);
  });

  $("li.poster-container a[href*='/film/'], li.griditem a[href*='/film/'], li.grid-item a[href*='/film/'], div.film-poster a[href*='/film/']").each((_, el) => {
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
    "li.poster-container, div.poster-container, div.film-poster, li.grid-item, li.griditem",
  ).each((_, el) => {
    const $el = $(el);
    const reactComponent = $el.find("[data-item-slug]").first();
    let slug = "";
    let title: string | undefined;
    let year: number | undefined;

    if (reactComponent.length) {
      slug = reactComponent.attr("data-item-slug") ?? "";
      const name = reactComponent.attr("data-item-name") ?? "";
      const titleMatch = name.match(/^(.+?)(?:\s*\((\d{4})\))?$/);
      title = titleMatch?.[1]?.trim();
      year = titleMatch?.[2] ? parseInt(titleMatch[2], 10) : undefined;
    } else {
      const link = $el.find('a[href*="/film/"]').first();
      const href = link.attr("href") ?? $el.attr("href") ?? "";
      const match = href.match(/\/film\/([^/]+)\/?/);
      if (!match) return;
      slug = match[1];

      const imgAlt = link.find("img").attr("alt") ?? "";
      const label = imgAlt || link.text().trim();
      const titleMatch = label.match(/^(.+?)(?:\s*\((\d{4})\))?$/);
      title = titleMatch?.[1]?.trim();
      year = titleMatch?.[2] ? parseInt(titleMatch[2], 10) : undefined;
    }

    if (!slug || seen.has(slug)) return;
    seen.add(slug);

    const rating = parseRatingFromElement($, el);
    if (rating <= 0) return;

    films.push({
      slug,
      title: title || slug.replace(/-/g, " "),
      year,
      rating,
    });
  });

  return films.sort((a, b) => b.rating - a.rating);
}

function mergeRatedFilms(htmlRated: RatedFilm[], rssRated: RatedFilm[]): RatedFilm[] {
  const map = new Map<string, RatedFilm>();

  for (const film of htmlRated) {
    map.set(film.slug, film);
  }

  for (const film of rssRated) {
    const existing = map.get(film.slug);
    if (!existing) {
      map.set(film.slug, film);
    } else if (existing.rating <= 0 && film.rating > 0) {
      map.set(film.slug, film);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.rating - a.rating);
}

export function getPageCount(html: string): number {
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

function warnPaginationIncomplete(
  pageCount: number,
  pagesFetched: number[],
  label: string,
) {
  if (pageCount <= 1) return;

  const fetched = new Set(pagesFetched);
  const missing: number[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    if (!fetched.has(page)) missing.push(page);
  }

  if (missing.length === 0) return;

  console.warn(
    `Letterboxd ${label} scrape was incomplete (missing pages: ${missing.join(", ")})`,
  );
}

async function fetchWatchedPageHtml(path: string): Promise<string> {
  try {
    return await fetchHtml(path);
  } catch (error) {
    if (!(error instanceof LetterboxdError) || error.status !== 403) {
      throw error;
    }
  }

  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  return fetchHtmlDirect(url);
}

async function fetchPaginatedFilms(
  pageCount: number,
  fetchPage: (page: number) => Promise<{
    films: LetterboxdFilm[];
    ratings?: RatedFilm[];
  }>,
): Promise<{
  films: LetterboxdFilm[];
  ratings: RatedFilm[];
  pagesFetched: number[];
}> {
  const allFilms: LetterboxdFilm[] = [];
  const allRated: RatedFilm[] = [];
  const pagesFetched: number[] = [];
  const pending = Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => index + 2);
  const workers = Math.min(4, pending.length);

  async function runWorker() {
    while (pending.length > 0) {
      const page = pending.shift();
      if (!page) return;

      try {
        const result = await fetchPage(page);
        pagesFetched.push(page);
        allFilms.push(...result.films);
        allRated.push(...(result.ratings ?? []));
      } catch (error) {
        console.warn(
          `Letterboxd pagination failed for page ${page}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, () => runWorker()));

  return { films: allFilms, ratings: allRated, pagesFetched };
}

function dedupeFilms(films: LetterboxdFilm[]): LetterboxdFilm[] {
  const unique = new Map<string, LetterboxdFilm>();
  for (const film of films) {
    unique.set(film.slug, film);
  }
  return Array.from(unique.values());
}

function dedupeRatedFilms(films: RatedFilm[]): RatedFilm[] {
  const unique = new Map<string, RatedFilm>();
  for (const film of films) {
    unique.set(film.slug, film);
  }
  return Array.from(unique.values()).sort((a, b) => b.rating - a.rating);
}

export function watchedFilmsPagePath(username: string, page: number): string {
  const normalized = username.trim().toLowerCase().replace(/^@/, "");
  if (page <= 1) {
    return `/${normalized}/films/`;
  }
  return `/${normalized}/films/page/${page}/`;
}

async function fetchAllPages(
  basePath: string,
  maxPages = 50,
): Promise<LetterboxdFilm[]> {
  const normalizedPath = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const firstHtml = await fetchHtml(normalizedPath);
  const pageCount = Math.min(getPageCount(firstHtml), maxPages);
  const allFilms = parseFilmsFromHtml(firstHtml);
  const remaining = await fetchPaginatedFilms(pageCount, async (page) => {
    const html = await fetchHtml(`${normalizedPath}page/${page}/`);
    return { films: parseFilmsFromHtml(html) };
  });
  allFilms.push(...remaining.films);

  return dedupeFilms(allFilms);
}

export async function fetchUserWatchedFilmsWithRatings(username: string): Promise<{
  films: LetterboxdFilm[];
  ratingsFromWatched: RatedFilm[];
  pagesFetched: number[];
}> {
  const normalized = username.trim().toLowerCase().replace(/^@/, "");
  const firstHtml = await fetchHtml(watchedFilmsPagePath(normalized, 1));
  const firstPageFilms = parseFilmsFromHtml(firstHtml);
  const firstPageRatings = parseRatedFilmsFromHtml(firstHtml);
  const pageCount = Math.min(getPageCount(firstHtml), WATCHED_FILMS_MAX_PAGES);
  const pagesFetched = [1];
  const allFilms: LetterboxdFilm[] = [...firstPageFilms];
  const allRated: RatedFilm[] = [...firstPageRatings];

  for (let page = 2; page <= pageCount; page += 1) {
    const path = watchedFilmsPagePath(normalized, page);

    try {
      const html = await fetchWatchedPageHtml(path);
      const pageFilms = parseFilmsFromHtml(html);
      if (pageFilms.length === 0) {
        console.warn(
          `Letterboxd watched page ${page} returned no films for ${normalized}`,
        );
        continue;
      }

      allFilms.push(...pageFilms);
      allRated.push(...parseRatedFilmsFromHtml(html));
      pagesFetched.push(page);
    } catch (error) {
      console.warn(
        `Letterboxd watched page ${page} skipped for ${normalized}:`,
        error instanceof Error ? error.message : error,
      );
    }

    if (page < pageCount) {
      await sleep(350);
    }
  }

  pagesFetched.sort((a, b) => a - b);
  warnPaginationIncomplete(pageCount, pagesFetched, "watched pages");

  return {
    films: dedupeFilms(allFilms),
    ratingsFromWatched: dedupeRatedFilms(allRated),
    pagesFetched,
  };
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
  const result = await fetchUserWatchlistWithSources(normalized);
  return result.films;
}

export async function fetchUserWatchlistWithSources(username: string): Promise<{
  films: LetterboxdFilm[];
  source: "html" | "rss" | "merged";
  htmlCount: number;
  rssCount: number;
}> {
  const normalized = username.trim().toLowerCase().replace(/^@/, "");
  let htmlFilms: LetterboxdFilm[] = [];

  try {
    htmlFilms = await fetchAllPages(`/${normalized}/watchlist/`);
  } catch {
    // HTML watchlist may be blocked; RSS fallback below.
  }

  let rssFilms: LetterboxdFilm[] = [];
  try {
    rssFilms = await fetchWatchlistFromRss(normalized);
  } catch {
    // Watchlist RSS unavailable for some profiles.
  }

  if (htmlFilms.length === 0 && rssFilms.length > 0) {
    return {
      films: rssFilms,
      source: "rss",
      htmlCount: 0,
      rssCount: rssFilms.length,
    };
  }

  if (htmlFilms.length > 0 && rssFilms.length > 0) {
    const merged = uniqueFilms(htmlFilms, rssFilms);
    return {
      films: merged,
      source: merged.length > htmlFilms.length ? "merged" : "html",
      htmlCount: htmlFilms.length,
      rssCount: rssFilms.length,
    };
  }

  return {
    films: htmlFilms,
    source: "html",
    htmlCount: htmlFilms.length,
    rssCount: 0,
  };
}

export async function fetchUserWatchedFilms(
  username: string,
): Promise<LetterboxdFilm[]> {
  const result = await fetchUserWatchedFilmsWithRatings(username);
  return result.films;
}

export async function fetchUserRatedFilms(
  username: string,
): Promise<RatedFilm[]> {
  const normalized = username.trim().toLowerCase().replace(/^@/, "");
  const firstHtml = await fetchHtml(`/${normalized}/films/ratings/`);
  const pageCount = Math.min(getPageCount(firstHtml), WATCHED_FILMS_MAX_PAGES);
  const allRated = parseRatedFilmsFromHtml(firstHtml);
  const remaining = await fetchPaginatedFilms(pageCount, async (page) => {
    const html = await fetchHtml(`/${normalized}/films/ratings/page/${page}/`);
    return { films: [], ratings: parseRatedFilmsFromHtml(html) };
  });
  allRated.push(...remaining.ratings);

  return dedupeRatedFilms(allRated);
}

export async function fetchUserGenreStats(
  username: string,
): Promise<GenreStat[]> {
  const normalized = username.trim().toLowerCase().replace(/^@/, "");
  const html = await fetchHtml(`/${normalized}/films/by/genre/`);
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
  const html = await fetchHtml(`/${normalized}/films/by/director/`);
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
  const normalized = username.trim().toLowerCase().replace(/^@/, "");

  try {
    return await syncLetterboxdUserFromHtml(normalized);
  } catch (htmlError) {
    if (htmlError instanceof LetterboxdError) {
      throw htmlError;
    }

    console.error("HTML Letterboxd sync failed, using RSS fallback:", htmlError);

    try {
      const rss = await fetchUserFromRss(normalized);
      if (rss.filmsWatched.length >= 50 || rss.filmsRated.length >= 50) {
        throw new LetterboxdError(
          "Letterboxd scraping is blocked and RSS fallback would be incomplete for this profile. Please try again in a moment.",
          503,
        );
      }
      const watchlistResult = await fetchUserWatchlistWithSources(normalized);

      return {
        username: rss.username,
        displayName: rss.displayName,
        avatarUrl: null,
        filmsWatchlist: watchlistResult.films,
        filmsWatched: rss.filmsWatched,
        filmsRated: rss.filmsRated,
        genreStats: [],
        directorStats: [],
        syncedAt: new Date().toISOString(),
        syncMode: "rss" as const,
        watchlistSource: watchlistResult.source,
        watchlistHtmlCount: watchlistResult.htmlCount,
        watchlistRssCount: watchlistResult.rssCount,
      };
    } catch (rssError) {
      if (htmlError instanceof LetterboxdError) throw htmlError;
      const message =
        rssError instanceof Error ? rssError.message : "Could not sync Letterboxd profile";
      throw new LetterboxdError(
        isNetworkFetchError(rssError) || message === "fetch failed"
          ? "Could not reach Letterboxd. The proxy may be down — please try again in a moment."
          : message,
        502,
      );
    }
  }
}

async function syncLetterboxdUserFromHtml(username: string) {
  const profile = await verifyLetterboxdUser(username);

  const watchlistResult = await fetchUserWatchlistWithSources(profile.username);

  const [watchedResult, filmsRated, genreStats, directorStats] =
    await Promise.all([
      fetchUserWatchedFilmsWithRatings(profile.username),
      fetchUserRatedFilms(profile.username).catch(() => [] as RatedFilm[]),
      fetchUserGenreStats(profile.username).catch(() => [] as GenreStat[]),
      fetchUserDirectorStats(profile.username).catch(
        () => [] as DirectorStat[],
      ),
    ]);

  const filmsWatchlist = watchlistResult.films;
  const filmsWatched = watchedResult.films;

  if (filmsWatchlist.length === 0 && filmsWatched.length === 0) {
    throw new LetterboxdError(
      "Could not fetch Letterboxd profile data",
      502,
    );
  }

  let rated = mergeRatedFilms(watchedResult.ratingsFromWatched, filmsRated);
  let watched = filmsWatched;

  try {
    const rss = await fetchUserFromRss(profile.username);

    if (rss.filmsRated.length > 0) {
      rated = mergeRatedFilms(rated, rss.filmsRated);
    }

    if (watched.length === 0) {
      watched = rss.filmsWatched;
    } else {
      const seen = new Set(watched.map((film) => film.slug));
      for (const film of rss.filmsWatched) {
        if (!seen.has(film.slug)) {
          watched.push(film);
        }
      }
    }
  } catch {
    // RSS supplement is optional.
  }

  return {
    ...profile,
    filmsWatchlist,
    filmsWatched: watched,
    filmsRated: rated,
    genreStats,
    directorStats,
    syncedAt: new Date().toISOString(),
    syncMode: "html" as const,
    watchlistSource: watchlistResult.source,
    watchlistHtmlCount: watchlistResult.htmlCount,
    watchlistRssCount: watchlistResult.rssCount,
  };
}

/** @internal Exported for unit tests only. */
export const parseRatedFilmsFromHtmlForTest = parseRatedFilmsFromHtml;
/** @internal Exported for unit tests only. */
export const parseFilmsFromMirrorMarkdownForTest = parseFilmsFromMirrorMarkdown;
