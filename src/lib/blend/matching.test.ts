import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  intersectFilmsRobust,
  matchReport,
  normalizeTitle,
} from "./matching.ts";

describe("film matching", () => {
  it("matches identical slugs", () => {
    const a = [{ slug: "inception", title: "Inception", year: 2010 }];
    const b = [{ slug: "inception", title: "Inception", year: 2010 }];
    assert.equal(intersectFilmsRobust(a, b).length, 1);
  });

  it("matches title casing and punctuation differences", () => {
    const a = [{ slug: "the-dark-knight", title: "The Dark Knight", year: 2008 }];
    const b = [{ slug: "dark-knight", title: "Dark Knight, The", year: 2008 }];
    const report = matchReport(a, b);
    assert.equal(report.titleYearMatches.length, 1);
    assert.equal(intersectFilmsRobust(a, b).length, 1);
  });

  it("matches when one side is missing year with same title", () => {
    const a = [{ slug: "parasite", title: "Parasite", year: 2019 }];
    const b = [{ slug: "parasite-2019", title: "Parasite" }];
    assert.equal(intersectFilmsRobust(a, b).length, 1);
  });

  it("does not false-match same title different years", () => {
    const a = [{ slug: "dune-1984", title: "Dune", year: 1984 }];
    const b = [{ slug: "dune-2021", title: "Dune", year: 2021 }];
    assert.equal(intersectFilmsRobust(a, b).length, 0);
  });

  it("matches via tmdb id when slugs differ", () => {
    const a = [{ slug: "inception", title: "Inception", year: 2010 }];
    const b = [{ slug: "inception-2010-alt", title: "Inception (2010)", year: 2011 }];
    const aTmdb = [{ ...a[0], tmdbId: 27205 }];
    const bTmdb = [{ ...b[0], tmdbId: 27205 }];
    const report = matchReport(a, b, aTmdb, bTmdb);
    assert.equal(report.tmdbMatches.length, 1);
    assert.equal(intersectFilmsRobust(a, b, aTmdb, bTmdb).length, 1);
  });

  it("normalizeTitle strips articles", () => {
    assert.equal(normalizeTitle("The Matrix"), normalizeTitle("Matrix"));
  });
});

describe("regression fixtures", () => {
  it("finds overlap between sample watchlist slugs", () => {
    const bwhome = [
      { slug: "sentimental-value", title: "Sentimental Value", year: 2025 },
      { slug: "obsession", title: "Obsession", year: 2026 },
      { slug: "dune-part-two", title: "Dune: Part Two", year: 2024 },
    ];
    const abhay = [
      { slug: "obsession-2026", title: "Obsession", year: 2026 },
      { slug: "sentimental-value-2025", title: "Sentimental Value", year: 2025 },
      { slug: "interstellar", title: "Interstellar", year: 2014 },
    ];
    const overlap = intersectFilmsRobust(bwhome, abhay);
    assert.equal(overlap.length, 2);
  });
});
