import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  artHouseBoost,
  artHouseTier,
  isArtHouseCandidate,
  isFestivalCanon,
  isMainstreamBlock,
} from "@/lib/tmdb/art-house";
import {
  enrichedFilmSimilarity,
  isBlockbuster,
  nicheAppeal,
  seedPriority,
  tasteFitScore,
} from "@/lib/blend/recommendations";
import type { EnrichedFilm } from "@/types/blend";

describe("art-house signals", () => {
  it("recognises Cannes canon and boutique acclaim", () => {
    assert.equal(isFestivalCanon(496243), true);
    assert.equal(artHouseTier({ tmdbId: 496243, voteAverage: 8.5 }), 3);
    assert.equal(
      artHouseTier({
        tmdbId: 999999,
        voteAverage: 7.6,
        voteCount: 900,
        popularity: 12,
      }),
      3,
    );
  });

  it("blocks obvious mainstream titles", () => {
    assert.equal(
      isMainstreamBlock({ tmdbId: 1, voteCount: 9000, popularity: 80 }),
      true,
    );
    assert.equal(
      isArtHouseCandidate({
        tmdbId: 1,
        voteAverage: 7.4,
        voteCount: 700,
        popularity: 11,
      }),
      true,
    );
  });

  it("boosts foreign and low-popularity critical picks", () => {
    const boost = artHouseBoost({
      tmdbId: 1,
      voteAverage: 7.8,
      voteCount: 600,
      popularity: 9,
      originalLanguage: "fr",
    });
    assert.ok(boost >= 8);
  });
});

describe("niche recommendation scoring", () => {
  it("prefers mid-list TMDB vote counts over blockbusters", () => {
    assert.ok(nicheAppeal(650, 12) > nicheAppeal(12_000, 90));
    assert.ok(nicheAppeal(650, 12) > nicheAppeal(40, 8));
  });

  it("flags mainstream titles as blockbusters", () => {
    assert.equal(isBlockbuster({ voteCount: 9000, popularity: 70 }), true);
    assert.equal(isBlockbuster({ voteCount: 700, popularity: 14 }), false);
  });

  it("ranks boutique seeds above tentpoles", () => {
    const indie: EnrichedFilm = {
      slug: "indie",
      title: "Indie",
      voteCount: 700,
      popularity: 11,
      voteAverage: 7.6,
    };
    const blockbuster: EnrichedFilm = {
      slug: "blockbuster",
      title: "Blockbuster",
      voteCount: 20_000,
      popularity: 120,
    };

    assert.ok(seedPriority(4.5, indie) > seedPriority(4.5, blockbuster));
  });

  it("scores metadata overlap between enriched films", () => {
    const a: EnrichedFilm = {
      slug: "a",
      title: "A",
      year: 2019,
      runtime: 110,
      genres: ["Drama", "Romance"],
      directors: ["Joachim Trier"],
    };
    const b: EnrichedFilm = {
      slug: "b",
      title: "B",
      year: 2021,
      runtime: 118,
      genres: ["Drama", "Romance"],
      directors: ["Joachim Trier"],
    };
    const c: EnrichedFilm = {
      slug: "c",
      title: "C",
      year: 1998,
      runtime: 150,
      genres: ["Action"],
      directors: ["Michael Bay"],
    };

    assert.ok(enrichedFilmSimilarity(a, b) > enrichedFilmSimilarity(a, c));
  });

  it("weights shared taste signals for both users", () => {
    const film: EnrichedFilm = {
      slug: "pick",
      title: "Pick",
      genres: ["Drama"],
      directors: ["Kelly Reichardt"],
    };
    const user1Genres = new Map([["drama", 12]]);
    const user2Genres = new Map([["drama", 10]]);
    const user1Directors = new Map([["kelly reichardt", 8]]);
    const user2Directors = new Map([["kelly reichardt", 6]]);

    const score = tasteFitScore(
      film,
      user1Genres,
      user2Genres,
      user1Directors,
      user2Directors,
    );

    assert.ok(score > 20);
  });
});
