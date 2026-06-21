import { posterUrl } from "@/lib/tmdb/client";
import type {
  BlendResults,
  ParticipantData,
  RecommendedFilm,
} from "@/types/blend";
import { FilmCarousel } from "@/components/FilmCarousel";
import { RecommendationDeck } from "@/components/RecommendationDeck";

function FilmGrid({
  films,
  emptyMessage,
}: {
  films: (BlendResults["movieMatch"]["commonWatched"][number] | RecommendedFilm)[];
  emptyMessage: string;
}) {
  if (films.length === 0) {
    return <p className="text-sm text-lb-fog">{emptyMessage}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {films.map((film) => {
        const poster = posterUrl(film.posterPath);

        return (
          <div
            key={film.slug}
            className="overflow-hidden rounded-sm border border-lb-graphite bg-lb-carbon"
          >
            <div className="relative aspect-[2/3] bg-lb-void">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={poster}
                  alt={film.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-3 text-center text-xs text-lb-fog">
                  {film.title}
                </div>
              )}
              {"rating" in film && film.rating !== undefined && (
                <span className="absolute left-2 top-2 rounded-sm bg-black/75 px-2 py-0.5 text-[10px] text-lb-star">
                  ★ {film.rating}
                </span>
              )}
            </div>
            <div className="p-2">
              <p className="truncate text-xs font-medium text-lb-white">
                {film.title}
              </p>
              {film.year && (
                <p className="text-[10px] text-lb-fog">{film.year}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-lb-graphite bg-lb-carbon">
        <span className="text-3xl font-bold text-lb-green">{score}%</span>
      </div>
      <p className="mt-3 text-sm font-medium text-lb-pewter">{label}</p>
    </div>
  );
}

function TopMatchCard({
  label,
  preference,
}: {
  label: string;
  preference: BlendResults["tasteProfile"]["topSharedGenre"];
}) {
  if (!preference) {
    return (
      <div className="rounded-xl border border-lb-graphite bg-lb-carbon p-4">
        <p className="eyebrow text-[10px] text-lb-fog">{label}</p>
        <p className="mt-2 text-sm text-lb-fog">No overlap detected yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-lb-graphite bg-lb-carbon p-4">
      <p className="eyebrow text-[10px] text-lb-fog">{label}</p>
      <p className="mt-2 text-lg font-semibold capitalize text-lb-white">
        {preference.name}
      </p>
      <p className="mt-1 text-xs text-lb-fog">
        Rank #{preference.user1Rank ?? preference.rank} & #{preference.user2Rank ?? preference.rank} · ★{" "}
        {preference.avgRating.toFixed(1)} avg · {preference.count} films
      </p>
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
  const taste = results.tasteProfile;
  const topSharedGenres = taste.sharedGenresRanked.slice(0, 3);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-lb-graphite bg-lb-carbon p-8">
        <h2 className="text-2xl font-bold text-lb-white">Your Film Blend</h2>
        <p className="mt-2 text-lb-fog">
          {name1} × {name2}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-10">
          <ScoreRing score={results.movieMatch.score} label="Movie Match" />
          <ScoreRing score={results.genreMatch.overlapScore} label="Genre Match" />
        </div>
      </section>

      <section className="rounded-2xl border border-lb-graphite bg-lb-carbon p-6">
        <h3 className="text-xl font-semibold text-lb-white">Shared Watchlist</h3>
        <p className="mt-1 text-sm text-lb-fog">
          <strong className="text-lb-green">{results.movieMatch.commonWatchlist.length}</strong>{" "}
          films on both of your watchlists
        </p>
        <div className="mt-6">
          <FilmGrid
            films={results.movieMatch.commonWatchlist}
            emptyMessage="No overlapping watchlist films yet. Try re-syncing both Letterboxd accounts."
          />
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-lb-white">Movie Match</h3>
        <p className="mt-1 text-sm text-lb-fog">
          {results.movieMatch.commonWatched.length} films you both watched
        </p>
        <div className="mt-6">
          <FilmCarousel
            films={results.movieMatch.commonWatched}
            emptyMessage="No overlapping watched films yet."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-lb-graphite bg-lb-carbon p-6">
        <h3 className="text-xl font-semibold text-lb-white">Common Taste Profile</h3>
        <p className="mt-1 text-sm text-lb-fog">
          Weighted from your watched films (rating + frequency via TMDB metadata)
          {taste.enrichmentCoverage.total > 0 && (
            <>
              {" "}
              — based on {taste.enrichmentCoverage.enriched} of{" "}
              {taste.enrichmentCoverage.total} logged films
            </>
          )}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <TopMatchCard label="Top shared genre" preference={taste.topSharedGenre} />
          <TopMatchCard
            label="Top shared director"
            preference={taste.topSharedDirector}
          />
        </div>

        {topSharedGenres.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-3 text-sm font-medium text-lb-pewter">
              Top shared genres
            </h4>
            <div className="flex flex-wrap gap-2">
              {topSharedGenres.map((genre) => (
                <span
                  key={genre.name}
                  className="rounded-full border border-lb-graphite bg-lb-void px-3 py-1 text-xs capitalize text-lb-pewter"
                >
                  {genre.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <h4 className="mb-3 text-sm font-medium text-lb-pewter">
            Films you both rated highly (4★+)
          </h4>
          <FilmCarousel
            films={taste.commonHighlyRated ?? []}
            emptyMessage="No overlapping high-rated films found."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-lb-graphite bg-lb-carbon p-6">
        <h3 className="text-xl font-semibold text-lb-white">Recommended for You Both</h3>
        <p className="mt-1 text-sm text-lb-fog">
          New discoveries based on your shared taste — excluding watched films and
          anything already on either watchlist
        </p>
        <div className="mt-6">
          <RecommendationDeck
            films={results.recommendations ?? []}
            emptyMessage="Add a TMDB API key to enable personalized recommendations."
          />
        </div>
      </section>
    </div>
  );
}
