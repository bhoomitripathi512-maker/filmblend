export interface LetterboxdFilm {
  slug: string;
  title: string;
  year?: number;
}

export interface RatedFilm extends LetterboxdFilm {
  /** Letterboxd rating on 0.5–5 star scale */
  rating: number;
}

export interface GenreStat {
  genre: string;
  count: number;
  percentage: number;
}

export interface DirectorStat {
  director: string;
  count: number;
}

export interface ParticipantData {
  slot: 1 | 2;
  letterboxdUsername: string;
  displayName: string | null;
  avatarUrl: string | null;
  filmsWatched: LetterboxdFilm[];
  filmsWatchlist: LetterboxdFilm[];
  filmsRated: RatedFilm[];
  genreStats: GenreStat[];
  directorStats: DirectorStat[];
  syncedAt: string | null;
}

export interface EnrichedFilm extends LetterboxdFilm {
  tmdbId?: number;
  posterPath?: string | null;
  genres?: string[];
  directors?: string[];
  runtime?: number | null;
  rating?: number;
}

export interface RecommendationExplanation {
  headline: string;
  summary: string;
  tasteSignals: string[];
  tmdbSignals: string[];
}

export interface RecommendedFilm extends EnrichedFilm {
  rank: number;
  reason: string;
  matchScore: number;
  explanation: RecommendationExplanation;
}

export interface GenreRecommendationGroup {
  genre: string;
  films: RecommendedFilm[];
}

export interface WeightedPreference {
  name: string;
  score: number;
  count: number;
  avgRating: number;
  rank: number;
  user1Rank?: number;
  user2Rank?: number;
}

export interface TasteProfile {
  topSharedGenre: WeightedPreference | null;
  topSharedDirector: WeightedPreference | null;
  sharedGenresRanked: WeightedPreference[];
  sharedDirectorsRanked: WeightedPreference[];
  user1TopGenres: WeightedPreference[];
  user2TopGenres: WeightedPreference[];
  user1TopDirectors: WeightedPreference[];
  user2TopDirectors: WeightedPreference[];
  commonHighlyRated: EnrichedFilm[];
  enrichmentCoverage: { enriched: number; total: number };
  /** @deprecated use sharedGenresRanked names */
  sharedGenres: string[];
  /** @deprecated use sharedDirectorsRanked names */
  sharedDirectors: string[];
}

export interface BlendResults {
  movieMatch: {
    score: number;
    commonWatched: EnrichedFilm[];
    commonWatchlist: EnrichedFilm[];
    totalUniqueFilms: number;
  };
  genreMatch: {
    sharedTopGenres: string[];
    user1TopGenres: GenreStat[];
    user2TopGenres: GenreStat[];
    overlapScore: number;
    /** @deprecated removed from UI — may exist in cached results */
    recommendations?: GenreRecommendationGroup[];
  };
  /** @deprecated removed from UI — may exist in cached results */
  watchTogether?: EnrichedFilm[];
  directorMatch: {
    sharedDirectors: DirectorStat[];
    user1TopDirectors: DirectorStat[];
    user2TopDirectors: DirectorStat[];
  };
  tasteProfile: TasteProfile;
  recommendations: RecommendedFilm[];
}

export interface Blend {
  id: string;
  slug: string;
  status: "waiting" | "partial" | "complete";
  participants: ParticipantData[];
  results: BlendResults | null;
  shareUrl: string;
  createdAt: string;
}
