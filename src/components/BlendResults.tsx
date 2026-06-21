import { posterUrl } from "@/lib/tmdb/client";
import type { BlendResults, ParticipantData, RecommendedFilm } from "@/types/blend";

function FilmGrid({
  films,
  emptyMessage,
  showReason,
}: {
  films: (BlendResults["movieMatch"]["commonWatched"][number] | RecommendedFilm)[];
  emptyMessage: string;
  showReason?: boolean;
}) {
  if (films.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyMessage}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {films.map((film) => {
        const poster = posterUrl(film.posterPath);
        const reason = "reason" in film ? film.reason : undefined;
        const matchScore = "matchScore" in film ? film.matchScore : undefined;

        return (
          <div
            key={film.slug}
            className="overflow-hidden rounded-xl border border-white/10 bg-white/5"
          >
            <div className="relative aspect-[2/3] bg-zinc-900">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={poster}
                  alt={film.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-3 text-center text-xs text-zinc-500">
                  {film.title}
                </div>
              )}
              {matchScore !== undefined && (
                <span className="absolute right-2 top-2 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-black">
                  {matchScore}%
                </span>
              )}
              {"rating" in film && film.rating !== undefined && (
                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-yellow-300">
                  ★ {film.rating}
                </span>
              )}
            </div>
            <div className="p-2">
              <p className="truncate text-xs font-medium text-white">
                {film.title}
              </p>
              {film.year && (
                <p className="text-[10px] text-zinc-500">{film.year}</p>
              )}
              {showReason && reason && (
                <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-zinc-400">
                  {reason}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GenreBars({
  title,
  genres,
}: {
  title: string;
  genres: { genre: string; count: number; percentage: number }[];
}) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-zinc-300">{title}</h4>
      <div className="space-y-2">
        {genres.slice(0, 5).map((g) => (
          <div key={g.genre}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="capitalize text-zinc-300">{g.genre}</span>
              <span className="text-zinc-500">{g.percentage}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-orange-500"
                style={{ width: `${Math.max(g.percentage, 4)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-orange-500/30 bg-orange-500/10">
        <span className="text-3xl font-bold text-orange-400">{score}%</span>
      </div>
      <p className="mt-3 text-sm font-medium text-zinc-300">{label}</p>
    </div>
  );
}

function TagList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-orange-500/20 px-3 py-1 text-sm capitalize text-orange-200"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function BlendResultsView({
  results,
  participants,
}: {
  results: BlendResults;
  participants: ParticipantData[];
}) {
  const [p1, p2] = participants;
  const name1 = p1.displayName ?? p1.letterboxdUsername;
  const name2 = p2.displayName ?? p2.letterboxdUsername;

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-orange-500/10 to-transparent p-8">
        <h2 className="text-2xl font-bold text-white">Your Film Blend</h2>
        <p className="mt-2 text-zinc-400">
          {name1} × {name2}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-10">
          <ScoreRing score={results.movieMatch.score} label="Movie Match" />
          <ScoreRing score={results.genreMatch.overlapScore} label="Genre Match" />
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
        <h3 className="text-xl font-semibold text-white">Shared Watchlist</h3>
        <p className="mt-1 text-sm text-zinc-400">
          {results.movieMatch.commonWatchlist.length} films on both of your
          watchlists — ready to pick from
        </p>
        <div className="mt-6">
          <FilmGrid
            films={results.movieMatch.commonWatchlist}
            emptyMessage="No overlapping watchlist films yet."
          />
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-white">Watch Together Next</h3>
        <p className="mt-1 text-sm text-zinc-400">
          From your shared watchlist — films neither of you has watched yet
        </p>
        <div className="mt-6">
          <FilmGrid
            films={results.watchTogether}
            emptyMessage="No unwatched overlap on your shared watchlists."
          />
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-white">Movie Match</h3>
        <p className="mt-1 text-sm text-zinc-400">
          {results.movieMatch.commonWatched.length} films you both watched
        </p>
        <div className="mt-6">
          <FilmGrid
            films={results.movieMatch.commonWatched}
            emptyMessage="No overlapping watched films yet."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-xl font-semibold text-white">Common Taste Profile</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Built from shared genres, highly rated films, and directors you both love
        </p>

        <div className="mt-6 space-y-6">
          <div>
            <h4 className="mb-2 text-sm font-medium text-zinc-300">
              Shared genres
            </h4>
            <TagList
              items={results.tasteProfile.sharedGenres}
              empty="No shared genres detected."
            />
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium text-zinc-300">
              Shared directors
            </h4>
            <TagList
              items={results.tasteProfile.sharedDirectors}
              empty="No shared directors detected."
            />
          </div>

          <div>
            <h4 className="mb-3 text-sm font-medium text-zinc-300">
              Films you both rated highly (4★+)
            </h4>
            <FilmGrid
              films={results.tasteProfile.commonHighlyRated}
              emptyMessage="No overlapping high-rated films found — ratings may be private."
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-xl font-semibold text-white">Genre Match</h3>
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <GenreBars title={name1} genres={results.genreMatch.user1TopGenres} />
          <GenreBars title={name2} genres={results.genreMatch.user2TopGenres} />
        </div>

        {results.genreMatch.recommendations.length > 0 && (
          <div className="mt-10 space-y-8">
            <h4 className="text-lg font-semibold text-white">
              Genre picks for you both
            </h4>
            {results.genreMatch.recommendations.map((group) => (
              <div key={group.genre}>
                <p className="mb-3 text-sm capitalize text-orange-300">
                  Because you both love {group.genre}
                </p>
                <FilmGrid
                  films={group.films}
                  emptyMessage=""
                  showReason
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-6">
        <h3 className="text-xl font-semibold text-white">
          Recommended for You Both
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          Suggestions based on films you both loved, shared genres, and directors
          — excluding what you&apos;ve already watched
        </p>
        <div className="mt-6">
          <FilmGrid
            films={results.recommendations}
            emptyMessage="Add a TMDB API key to enable personalized recommendations."
            showReason
          />
        </div>
      </section>

      {results.directorMatch.sharedDirectors.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-xl font-semibold text-white">Director Match</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {results.directorMatch.sharedDirectors.map((d) => (
              <span
                key={d.director}
                className="rounded-full border border-white/10 px-3 py-1 text-sm text-zinc-200"
              >
                {d.director}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
