import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WATCHED_FILMS_MAX_PAGES,
  watchedFilmsPagePath,
} from "@/lib/letterboxd/fetcher";

const WATCHED_PAGE_FIXTURE = `
<ul>
  <li class="griditem">
    <div class="react-component" data-item-slug="sentimental-value" data-item-name="Sentimental Value (2025)"></div>
    <p class="poster-viewingdata"><span class="rating -micro -darker rated-10">★★★★★</span></p>
  </li>
  <li class="griditem">
    <div class="react-component" data-item-slug="hamnet" data-item-name="Hamnet (2025)"></div>
    <p class="poster-viewingdata"><span class="rating -micro -darker rated-8">★★★★</span></p>
  </li>
</ul>`;

describe("watchedFilmsPagePath", () => {
  it("builds paginated /films/page/N/ URLs for pages 1 through 5", () => {
    assert.equal(WATCHED_FILMS_MAX_PAGES, 5);
    assert.equal(watchedFilmsPagePath("bwhome", 1), "/bwhome/films/page/1/");
    assert.equal(watchedFilmsPagePath("BWHOME", 3), "/bwhome/films/page/3/");
    assert.equal(watchedFilmsPagePath("@ishikabhandari", 5), "/ishikabhandari/films/page/5/");
  });
});

describe("parseRatedFilmsFromHtml griditem", () => {
  it("reads ratings from watched /films/ grid markup", async () => {
    const { parseRatedFilmsFromHtmlForTest: parseRatedFilmsFromHtml } =
      await import("@/lib/letterboxd/fetcher");
    const rated = parseRatedFilmsFromHtml(WATCHED_PAGE_FIXTURE);
    assert.equal(rated.length, 2);
    assert.equal(rated[0].slug, "sentimental-value");
    assert.equal(rated[0].rating, 5);
    assert.equal(rated[1].slug, "hamnet");
    assert.equal(rated[1].rating, 4);
  });
});
