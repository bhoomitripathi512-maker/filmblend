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

const MIRROR_PAGE_FIXTURE = `
*   ![Image 3: Poster for The Greatest Hits (2024)](https://a.ltrbxd.com/poster.jpg?v=1)[The Greatest Hits (2024)](https://letterboxd.com/film/the-greatest-hits/)  
★★★★[](https://letterboxd.com/bwhome/film/the-greatest-hits/)

*   ![Image 4: Poster for Set It Up (2018)](https://a.ltrbxd.com/poster-x.jpg?v=1)[Set It Up (2018)](https://letterboxd.com/film/set-it-up/)  
*   ![Image 5: Poster for Civil War (2024)](https://a.ltrbxd.com/poster-2.jpg?v=1)[Civil War (2024)](https://letterboxd.com/film/civil-war-2024/)  
★★★★½
`;

describe("watchedFilmsPagePath", () => {
  it("uses the canonical first page path and raises the watched-page cap", () => {
    assert.equal(WATCHED_FILMS_MAX_PAGES, 30);
    assert.equal(watchedFilmsPagePath("bwhome", 1), "/bwhome/films/");
    assert.equal(watchedFilmsPagePath("BWHOME", 3), "/bwhome/films/page/3/");
    assert.equal(watchedFilmsPagePath("@ishikabhandari", 30), "/ishikabhandari/films/page/30/");
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

describe("parseFilmsFromMirrorMarkdown", () => {
  it("extracts watched films and visible star ratings from jina mirror markdown", async () => {
    const { parseFilmsFromMirrorMarkdownForTest: parseFilmsFromMirrorMarkdown } =
      await import("@/lib/letterboxd/fetcher");

    const parsed = parseFilmsFromMirrorMarkdown(MIRROR_PAGE_FIXTURE);

    assert.equal(parsed.films.length, 3);
    assert.deepEqual(parsed.films[0], {
      slug: "the-greatest-hits",
      title: "The Greatest Hits",
      year: 2024,
    });
    assert.deepEqual(parsed.films[1], {
      slug: "set-it-up",
      title: "Set It Up",
      year: 2018,
    });
    assert.deepEqual(parsed.films[2], {
      slug: "civil-war-2024",
      title: "Civil War",
      year: 2024,
    });

    assert.equal(parsed.ratings.length, 2);
    assert.equal(parsed.ratings[0]?.rating, 4);
    assert.equal(parsed.ratings[1]?.rating, 4.5);
  });
});
