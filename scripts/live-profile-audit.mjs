const {
  syncLetterboxdUser,
  fetchUserWatchedFilmsWithRatings,
  WATCHED_FILMS_MAX_PAGES,
  watchedFilmsPagePath,
} = await import("../src/lib/letterboxd/fetcher.ts");
const { matchReport, intersectFilmsRobust } = await import(
  "../src/lib/blend/matching.ts"
);

const USERS = ["bwhome", "ishikabhandari"];

function ratingHistogram(rated) {
  const hist = { "5": 0, "4.5": 0, "4": 0, "3.5": 0, "3": 0, "2.5": 0, "2": 0, "1.5": 0, "1": 0, "0.5": 0 };
  for (const f of rated) {
    const key = String(f.rating);
    if (key in hist) hist[key]++;
  }
  return hist;
}

function summarizeUser(sync, watchedDetail) {
  const { films, ratingsFromWatched, pagesFetched } = watchedDetail;
  const ratedSlugsFromWatched = new Set(ratingsFromWatched.map((f) => f.slug));
  const watchedWithoutRatingOnPage = films.filter(
    (f) => !ratedSlugsFromWatched.has(f.slug),
  );

  return {
    username: sync.username,
    displayName: sync.displayName,
    syncMode: sync.syncMode,
    watchlistSource: sync.watchlistSource,
    watchlistHtmlCount: sync.watchlistHtmlCount,
    watchlistRssCount: sync.watchlistRssCount,
    counts: {
      watchlist: sync.filmsWatchlist.length,
      watched: sync.filmsWatched.length,
      ratedMerged: sync.filmsRated.length,
      ratedFromWatchedPages: ratingsFromWatched.length,
      ratedFromDedicatedRatingsPage: sync.filmsRated.length - ratingsFromWatched.length,
      watchedWithoutRatingOnPages: watchedWithoutRatingOnPage.length,
      genreStats: sync.genreStats.length,
      directorStats: sync.directorStats.length,
    },
    watchedPages: {
      maxConfigured: WATCHED_FILMS_MAX_PAGES,
      pagesFetched,
      pagesMissing: Array.from({ length: WATCHED_FILMS_MAX_PAGES }, (_, i) => i + 1).filter(
        (p) => !pagesFetched.includes(p),
      ),
      pagePaths: Array.from({ length: WATCHED_FILMS_MAX_PAGES }, (_, i) =>
        watchedFilmsPagePath(sync.username, i + 1),
      ),
    },
    ratingHistogram: ratingHistogram(sync.filmsRated),
    topGenres: sync.genreStats.slice(0, 5).map((g) => `${g.genre} (${g.count})`),
    topDirectors: sync.directorStats.slice(0, 5).map((d) => `${d.director} (${d.count})`),
  };
}

function summarizeBlend(user1, user2, results) {
  const watchedReport = matchReport(user1.filmsWatched, user2.filmsWatched);
  const watchlistReport = matchReport(user1.filmsWatchlist, user2.filmsWatchlist);
  const ratedReport = matchReport(user1.filmsRated, user2.filmsRated);

  return {
    movieMatchScore: results.movieMatch.score,
    totalUniqueFilms: results.movieMatch.totalUniqueFilms,
    commonWatched: {
      total: results.movieMatch.commonWatched.length,
      slugOnly: watchedReport.slugMatches.length - watchedReport.titleYearMatches.length - watchedReport.titleOnlyMatches.length - watchedReport.tmdbMatches.length,
      titleYearFuzzy: watchedReport.titleYearMatches.length,
      titleOnlyFuzzy: watchedReport.titleOnlyMatches.length,
      tmdbFuzzy: watchedReport.tmdbMatches.length,
      robustIntersect: intersectFilmsRobust(user1.filmsWatched, user2.filmsWatched).length,
    },
    commonWatchlist: {
      total: results.movieMatch.commonWatchlist.length,
      slugOnly: watchlistReport.slugMatches.length - watchlistReport.titleYearMatches.length - watchlistReport.titleOnlyMatches.length - watchlistReport.tmdbMatches.length,
      titleYearFuzzy: watchlistReport.titleYearMatches.length,
      titleOnlyFuzzy: watchlistReport.titleOnlyMatches.length,
    },
    commonRated: ratedReport.slugMatches.length,
    genreOverlapScore: results.genreMatch.overlapScore,
    sharedTopGenres: results.genreMatch.sharedTopGenres,
    sharedDirectors: results.directorMatch.sharedDirectors.map((d) => `${d.director} (${d.count})`),
    commonHighlyRated: results.tasteProfile.commonHighlyRated.length,
    recommendationsCount: results.recommendations.length,
    enrichmentCoverage: results.tasteProfile.enrichmentCoverage,
    uiShows: {
      movieMatch: ["score", "commonWatched", "commonWatchlist"],
      genreMatch: ["sharedTopGenres", "user1TopGenres", "user2TopGenres", "overlapScore"],
      directorMatch: ["sharedDirectors", "user1TopDirectors", "user2TopDirectors"],
      tasteProfile: [
        "topSharedGenre",
        "topSharedDirector",
        "sharedGenresRanked",
        "sharedDirectorsRanked",
        "commonHighlyRated",
      ],
      recommendations: ["ranked TMDB picks with explanations"],
    },
    uiDoesNotShow: [
      "full watched lists per user",
      "full watchlist per user",
      "all rated films individually",
      "unmatched films between profiles",
      "films watched without ratings",
      "genre/director stats beyond top slices",
      "sync diagnostics (pages fetched, source)",
    ],
  };
}

const profiles = [];

for (const username of USERS) {
  console.error(`Syncing ${username}...`);
  const sync = await syncLetterboxdUser(username);
  const watchedDetail = await fetchUserWatchedFilmsWithRatings(username);
  profiles.push({ sync, watchedDetail });
}

const [p1, p2] = profiles;
console.error("Computing blend overlap (no TMDB)...");
const blendOverlap = summarizeBlend(p1.sync, p2.sync, {
  movieMatch: {
    score: 0,
    commonWatched: intersectFilmsRobust(p1.sync.filmsWatched, p2.sync.filmsWatched),
    commonWatchlist: intersectFilmsRobust(p1.sync.filmsWatchlist, p2.sync.filmsWatchlist),
    totalUniqueFilms: 0,
  },
  genreMatch: { sharedTopGenres: [], overlapScore: 0 },
  directorMatch: { sharedDirectors: [] },
  tasteProfile: { commonHighlyRated: [], enrichmentCoverage: { enriched: 0, total: 0 } },
  recommendations: [],
});

const output = {
  users: profiles.map((p) => summarizeUser(p.sync, p.watchedDetail)),
  blend: blendOverlap,
};

console.log(JSON.stringify(output, null, 2));
