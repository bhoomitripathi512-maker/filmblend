import {
  fetchUserGenreStats,
  fetchUserDirectorStats,
} from "../src/lib/letterboxd/fetcher.ts";

for (const u of ["bwhome", "ishikabhandari"]) {
  const genres = await fetchUserGenreStats(u);
  const directors = await fetchUserDirectorStats(u);
  console.log(u, { genres: genres.length, directors: directors.length });
  if (genres.length) console.log("  top genre", genres[0]);
  if (directors.length) console.log("  top director", directors[0]);
}
