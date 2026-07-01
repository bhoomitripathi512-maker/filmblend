import type { LetterboxdFilm } from "@/types/blend";

export interface FilmMatchReport {
  slugMatches: LetterboxdFilm[];
  titleYearMatches: LetterboxdFilm[];
  titleOnlyMatches: LetterboxdFilm[];
  tmdbMatches: LetterboxdFilm[];
  unmatchedA: LetterboxdFilm[];
  unmatchedB: LetterboxdFilm[];
}

const ARTICLE_PREFIX = /^(the|a|an)\s+/;

export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/\/+$/, "");
}

export function normalizeTitle(title: string): string {
  let normalized = title
    .toLowerCase()
    .replace(/[^\w\s,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  normalized = normalized.replace(/,\s*the$/, "").trim();
  normalized = normalized.replace(ARTICLE_PREFIX, "").trim();

  return normalized;
}

function getDisambigBase(slug: string): string | null {
  const match = slug.match(/^(.+)-([1-9]\d*)$/);
  if (!match) return null;
  // Release years in slugs are 4 digits; Letterboxd duplicate suffixes are short.
  if (match[2].length >= 4) return null;
  return match[1];
}

/** Letterboxd uses `-1`, `-2`, … suffixes for distinct films that share a base slug. */
export function areLetterboxdSlugConflicts(slugA: string, slugB: string): boolean {
  const a = normalizeSlug(slugA);
  const b = normalizeSlug(slugB);
  if (!a || !b || a === b) return false;

  const baseA = getDisambigBase(a);
  const baseB = getDisambigBase(b);

  if (baseA === b || baseB === a) return true;
  if (baseA && baseB && baseA === baseB) return true;

  return false;
}

export function filmKey(film: LetterboxdFilm): string {
  const slug = normalizeSlug(film.slug);
  if (slug) return `slug:${slug}`;
  const title = normalizeTitle(film.title);
  if (film.year) return `title:${title}|${film.year}`;
  return `title:${title}`;
}

function pickCanonical(a: LetterboxdFilm, b: LetterboxdFilm): LetterboxdFilm {
  const slugA = normalizeSlug(a.slug);
  const slugB = normalizeSlug(b.slug);

  if (slugA === slugB) return a;

  const baseA = getDisambigBase(slugA);
  const baseB = getDisambigBase(slugB);
  if (baseA === slugB) return b;
  if (baseB === slugA) return a;

  if (a.year && !b.year) return a;
  if (b.year && !a.year) return b;
  if (a.title.length >= b.title.length) return a;
  return b;
}

function indexBySlug(films: LetterboxdFilm[]): Map<string, LetterboxdFilm> {
  const map = new Map<string, LetterboxdFilm>();
  for (const film of films) {
    const slug = normalizeSlug(film.slug);
    if (slug) map.set(slug, film);
  }
  return map;
}

function indexByTitleYear(films: LetterboxdFilm[]): Map<string, LetterboxdFilm[]> {
  const map = new Map<string, LetterboxdFilm[]>();
  for (const film of films) {
    if (!film.year) continue;
    const key = `${normalizeTitle(film.title)}|${film.year}`;
    const list = map.get(key) ?? [];
    list.push(film);
    map.set(key, list);
  }
  return map;
}

function indexByTitleOnly(films: LetterboxdFilm[]): Map<string, LetterboxdFilm[]> {
  const map = new Map<string, LetterboxdFilm[]>();
  for (const film of films) {
    const key = normalizeTitle(film.title);
    const list = map.get(key) ?? [];
    list.push(film);
    map.set(key, list);
  }
  return map;
}

function indexByTmdbId(
  films: Array<LetterboxdFilm & { tmdbId?: number }>,
): Map<number, LetterboxdFilm> {
  const map = new Map<number, LetterboxdFilm>();
  for (const film of films) {
    if (film.tmdbId) map.set(film.tmdbId, film);
  }
  return map;
}

export function matchReport(
  a: LetterboxdFilm[],
  b: LetterboxdFilm[],
  aTmdb?: Array<LetterboxdFilm & { tmdbId?: number }>,
  bTmdb?: Array<LetterboxdFilm & { tmdbId?: number }>,
): FilmMatchReport {
  const slugMatches: LetterboxdFilm[] = [];
  const titleYearMatches: LetterboxdFilm[] = [];
  const titleOnlyMatches: LetterboxdFilm[] = [];
  const tmdbMatches: LetterboxdFilm[] = [];
  const matchedASlugs = new Set<string>();
  const matchedBSlugs = new Set<string>();

  const bBySlug = indexBySlug(b);
  for (const film of a) {
    const slug = normalizeSlug(film.slug);
    const match = bBySlug.get(slug);
    if (match) {
      slugMatches.push(pickCanonical(film, match));
      matchedASlugs.add(slug);
      matchedBSlugs.add(normalizeSlug(match.slug));
    }
  }

  const bByTitleYear = indexByTitleYear(
    b.filter((f) => !matchedBSlugs.has(normalizeSlug(f.slug))),
  );
  for (const film of a) {
    const slug = normalizeSlug(film.slug);
    if (matchedASlugs.has(slug) || !film.year) continue;
    const key = `${normalizeTitle(film.title)}|${film.year}`;
    const candidates = bByTitleYear.get(key);
    if (!candidates?.length) continue;
    const match = candidates.find(
      (candidate) => !areLetterboxdSlugConflicts(slug, candidate.slug),
    );
    if (!match) continue;
    slugMatches.push(pickCanonical(film, match));
    titleYearMatches.push(pickCanonical(film, match));
    matchedASlugs.add(slug);
    matchedBSlugs.add(normalizeSlug(match.slug));
  }

  const bByTitle = indexByTitleOnly(
    b.filter((f) => !matchedBSlugs.has(normalizeSlug(f.slug))),
  );
  for (const film of a) {
    const slug = normalizeSlug(film.slug);
    if (matchedASlugs.has(slug)) continue;
    const key = normalizeTitle(film.title);
    const candidates = bByTitle.get(key);
    if (!candidates?.length) continue;
    const match = candidates.find(
      (c) =>
        !areLetterboxdSlugConflicts(slug, c.slug) &&
        (!c.year || !film.year || c.year === film.year),
    );
    if (!match) continue;
    if (film.year && match.year && film.year !== match.year) continue;
    slugMatches.push(pickCanonical(film, match));
    titleOnlyMatches.push(pickCanonical(film, match));
    matchedASlugs.add(slug);
    matchedBSlugs.add(normalizeSlug(match.slug));
  }

  if (aTmdb?.length && bTmdb?.length) {
    const bTmdbMap = indexByTmdbId(
      bTmdb.filter((f) => !matchedBSlugs.has(normalizeSlug(f.slug))),
    );
    for (const film of aTmdb) {
      const slug = normalizeSlug(film.slug);
      if (matchedASlugs.has(slug) || !film.tmdbId) continue;
      const match = bTmdbMap.get(film.tmdbId);
      if (!match) continue;
      slugMatches.push(pickCanonical(film, match));
      tmdbMatches.push(pickCanonical(film, match));
      matchedASlugs.add(slug);
      matchedBSlugs.add(normalizeSlug(match.slug));
    }
  }

  const unique = new Map<string, LetterboxdFilm>();
  for (const film of slugMatches) {
    const key = film.year
      ? `title:${normalizeTitle(film.title)}|${film.year}`
      : normalizeSlug(film.slug);
    if (!unique.has(key)) {
      unique.set(key, film);
      continue;
    }
    unique.set(key, pickCanonical(unique.get(key)!, film));
  }

  return {
    slugMatches: Array.from(unique.values()),
    titleYearMatches,
    titleOnlyMatches,
    tmdbMatches,
    unmatchedA: a.filter((f) => !matchedASlugs.has(normalizeSlug(f.slug))),
    unmatchedB: b.filter((f) => !matchedBSlugs.has(normalizeSlug(f.slug))),
  };
}

export function intersectFilmsRobust(
  a: LetterboxdFilm[],
  b: LetterboxdFilm[],
  aTmdb?: Array<LetterboxdFilm & { tmdbId?: number }>,
  bTmdb?: Array<LetterboxdFilm & { tmdbId?: number }>,
): LetterboxdFilm[] {
  return matchReport(a, b, aTmdb, bTmdb).slugMatches;
}

export function uniqueFilms(...lists: LetterboxdFilm[][]): LetterboxdFilm[] {
  const map = new Map<string, LetterboxdFilm>();
  for (const list of lists) {
    for (const film of list) {
      const tmdbId =
        "tmdbId" in film &&
        typeof film.tmdbId === "number" &&
        Number.isFinite(film.tmdbId)
          ? film.tmdbId
          : null;
      const key = tmdbId
        ? `tmdb:${tmdbId}`
        : film.year
          ? `title:${normalizeTitle(film.title)}|${film.year}`
          : `slug:${normalizeSlug(film.slug)}`;
      map.set(key, film);
    }
  }
  return Array.from(map.values());
}
