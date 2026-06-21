import * as cheerio from "cheerio";
import { fetchViaProxy, isNetworkFetchError, letterboxdProxyBase } from "@/lib/letterboxd/request";
import { fetchUserFromRss, fetchWatchlistFromRss } from "@/lib/letterboxd/rss";
import { uniqueFilms } from "@/lib/blend/matching";
import type { DirectorStat, GenreStat, LetterboxdFilm, RatedFilm } from "@/types/blend";

const BASE_URL = "https://letterboxd.com";

async function ensureHeaderGeneratorData(): Promise<void> {
  const fs = await import("node:fs");
  const path = await import("node:path");

  const targetDir = path.join(
    process.cwd(),
    "node_modules/header-generator/data_files",
  );
  const sourceDir = path.join(
    process.cwd(),
    "src/vendor/header-generator/data_files",
  );

  if (
    fs.existsSync(path.join(targetDir, "headers-order.json")) ||
    !fs.existsSync(sourceDir)
  ) {
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
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

async function fetchHtml(path: string): Promise<string> {
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

      if (!response.ok) {
        throw new LetterboxdError(
          `Letterboxd request failed (${response.status})`,
          response.status,
        );
      }

      return response.text();
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
  await ensureHeaderGeneratorData();
  const { gotScraping } = await import("got-scraping");

  try {
    const response = await gotScraping({
      url,
      headers: BROWSER_HEADERS,
      retry: { limit: 2 },
      timeout: { request: 25_000 },
    });

    if (response.statusCode === 404) {
      throw new LetterboxdError("User not found or profile is private", 404);
    }

    if (response.statusCode !== 200) {
      throw new LetterboxdError(
        `Letterboxd request failed (${response.statusCode})`,
        response.statusCode,
      );
    }

    return response.body;
  } catch (error) {
    if (error instanceof LetterboxdError) throw error;

    const statusCode =
      error &&
      typeof error === "object" &&
      "response" in error &&
      error.response &&
      typeof error.response === "object" &&
      "statusCode" in error.response
        ? (error.response.statusCode as number)
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
  const normalizedPath = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const firstHtml = await fetchHtml(normalizedPath);
  const pageCount = Math.min(getPageCount(firstHtml), maxPages);
  const allFilms = parseFilmsFromHtml(firstHtml);

  for (let page = 2; page <= pageCount; page += 1) {
    try {
      const html = await fetchHtml(`${normalizedPath}page/${page}/`);
      allFilms.push(...parseFilmsFromHtml(html));
    } catch {
      // Letterboxd often blocks paginated /films/ requests; keep page 1 data.
      break;
    }
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
    console.error("HTML Letterboxd sync failed, using RSS fallback:", htmlError);

    try {
      const rss = await fetchUserFromRss(normalized);
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

  const [filmsWatched, filmsRated, genreStats, directorStats] =
    await Promise.all([
      fetchUserWatchedFilms(profile.username).catch(() => [] as LetterboxdFilm[]),
      fetchUserRatedFilms(profile.username).catch(() => [] as RatedFilm[]),
      fetchUserGenreStats(profile.username).catch(() => [] as GenreStat[]),
      fetchUserDirectorStats(profile.username).catch(
        () => [] as DirectorStat[],
      ),
    ]);

  const filmsWatchlist = watchlistResult.films;

  if (filmsWatchlist.length === 0 && filmsWatched.length === 0) {
    throw new LetterboxdError(
      "Could not fetch Letterboxd profile data",
      502,
    );
  }

  let rated = filmsRated;
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
