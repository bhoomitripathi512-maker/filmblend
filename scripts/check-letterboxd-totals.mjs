const { fetchHtml } = await import("../src/lib/letterboxd/fetcher.ts");

// getPageCount is not exported - inline duplicate
import * as cheerio from "cheerio";

function pageCount(html) {
  const $ = cheerio.load(html);
  let maxPage = 1;
  $(".paginate-pages a, .pagination li a").each((_, el) => {
    const page = parseInt($(el).text().trim(), 10);
    if (!Number.isNaN(page) && page > maxPage) maxPage = page;
  });
  return maxPage;
}

function profileFilmCount(html) {
  const $ = cheerio.load(html);
  const text =
    $(".profile-stats .stat").first().find(".value").text().trim() ||
    $("a[href$='/films/'] .value").first().text().trim();
  return parseInt(text, 10) || null;
}

async function audit(username) {
  const profileHtml = await fetchHtml(`/${username}/`);
  const filmsPage1 = await fetchHtml(`/${username}/films/page/1/`);
  const ratingsPage1 = await fetchHtml(`/${username}/films/ratings/`);

  const filmsPerPage = cheerio.load(filmsPage1)(".poster-container, .griditem, li.poster-container").length;

  return {
    username,
    letterboxdProfileFilmCount: profileFilmCount(profileHtml),
    watchedPagesTotal: pageCount(filmsPage1),
    ratingsPagesTotal: pageCount(ratingsPage1),
    filmsOnPage1: filmsPerPage,
    cappedAt5Pages: Math.min(pageCount(filmsPage1), 5) * filmsPerPage,
  };
}

for (const u of ["bwhome", "ishikabhandari"]) {
  console.error(`Checking ${u} on Letterboxd...`);
  console.log(JSON.stringify(await audit(u)));
}
