import type {
  RecommendationExplanation,
  TasteProfile,
  WeightedPreference,
} from "@/types/blend";

interface ExplanationInput {
  title: string;
  seedTitles: string[];
  matchedGenres: string[];
  matchedDirectors: string[];
  tmdbSources: Array<"recommendations" | "similar" | "discover">;
  tasteProfile: TasteProfile;
  rank: number;
}

function formatList(items: string[], limit = 3): string {
  const slice = items.slice(0, limit);
  if (slice.length === 0) return "";
  if (slice.length === 1) return slice[0];
  if (slice.length === 2) return `${slice[0]} and ${slice[1]}`;
  return `${slice.slice(0, -1).join(", ")}, and ${slice[slice.length - 1]}`;
}

function rankLabel(pref: WeightedPreference | null, label: string): string | null {
  if (!pref) return null;
  const ranks: string[] = [];
  if (pref.user1Rank) ranks.push(`#${pref.user1Rank} for one of you`);
  if (pref.user2Rank) ranks.push(`#${pref.user2Rank} for the other`);
  if (ranks.length === 0) return `Shared love of ${label}: ${pref.name}`;
  return `${pref.name} (${ranks.join(" · ")})`;
}

export function buildExplanation(input: ExplanationInput): RecommendationExplanation {
  const tasteSignals: string[] = [];
  const tmdbSignals: string[] = [];

  if (input.tasteProfile.topSharedGenre && input.matchedGenres.length > 0) {
    tasteSignals.push(
      rankLabel(input.tasteProfile.topSharedGenre, "genre") ??
        `Shared genre: ${input.matchedGenres[0]}`,
    );
  }

  for (const genre of input.matchedGenres.slice(0, 2)) {
    if (!tasteSignals.some((s) => s.includes(genre))) {
      tasteSignals.push(`Matches your shared taste for ${genre}`);
    }
  }

  if (input.tasteProfile.topSharedDirector && input.matchedDirectors.length > 0) {
    tasteSignals.push(
      rankLabel(input.tasteProfile.topSharedDirector, "director") ??
        `Shared director taste: ${input.matchedDirectors[0]}`,
    );
  }

  for (const director of input.matchedDirectors.slice(0, 2)) {
    if (!tasteSignals.some((s) => s.includes(director))) {
      tasteSignals.push(`From ${director}, a director you both enjoy`);
    }
  }

  if (input.seedTitles.length > 0) {
    tmdbSignals.push(
      `TMDB surfaced this near ${formatList(input.seedTitles)} — films that shaped your blend`,
    );
  }

  if (input.tmdbSources.includes("similar")) {
    tmdbSignals.push("Similar titles in tone, cast, and themes");
  }
  if (input.tmdbSources.includes("recommendations")) {
    tmdbSignals.push("Community recommendations aligned with your favorites");
  }
  if (input.tmdbSources.includes("discover")) {
    tmdbSignals.push("Highly rated pick in a genre you both lean toward");
  }

  const topGenre = input.tasteProfile.topSharedGenre?.name;
  const parts: string[] = [];

  if (topGenre && input.matchedGenres.some((g) => g.toLowerCase() === topGenre.toLowerCase())) {
    parts.push(
      `You both gravitate toward ${topGenre}, your top shared genre`,
    );
  } else if (input.matchedGenres.length > 0) {
    parts.push(`This fits genres you both watch often — especially ${input.matchedGenres[0]}`);
  }

  if (input.seedTitles.length > 0) {
    parts.push(
      `TMDB links it to ${formatList(input.seedTitles)}, which anchor your overlapping taste`,
    );
  } else {
    parts.push("TMDB taste graphs suggest this is a strong match for your combined history");
  }

  parts.push("It is not on either watchlist and neither of you has logged it as watched.");

  const headline =
    input.rank === 1 ? "You'll both love this" : `Pick #${input.rank} for you both`;

  return {
    headline,
    summary: parts.join(". ") + ".",
    tasteSignals,
    tmdbSignals,
  };
}

export function buildGenrePickExplanation(
  genre: string,
  tasteProfile: TasteProfile,
): RecommendationExplanation {
  const shared = tasteProfile.sharedGenresRanked.find(
    (g) => g.name.toLowerCase() === genre.toLowerCase(),
  );

  return {
    headline: `Because you both love ${genre}`,
    summary: shared
      ? `${genre} ranks high for both of you (combined preference score ${shared.score.toFixed(1)}). This is a well-rated TMDB pick in that lane you have not watched yet.`
      : `A popular ${genre} film from TMDB that is new to both of your histories.`,
    tasteSignals: shared
      ? [`${genre} is a shared favorite genre`]
      : [`${genre} appears in both viewing patterns`],
    tmdbSignals: ["Discovered via TMDB genre browse, sorted by rating"],
  };
}
