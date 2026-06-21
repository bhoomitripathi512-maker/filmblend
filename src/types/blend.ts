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

export interface RecommendedFilm extends EnrichedFilm {
  reason: string;
  matchScore: number;
}

export interface GenreRecommendationGroup {
  genre: string;
  films: RecommendedFilm[];
}

export interface TasteProfile {
  sharedGenres: string[];
  sharedDirectors: string[];
  commonHighlyRated: EnrichedFilm[];
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
    recommendations: GenreRecommendationGroup[];
  };
  watchTogether: EnrichedFilm[];
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
