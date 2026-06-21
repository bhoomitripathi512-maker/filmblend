import type {
  BlendResults,
  ParticipantData,
  WeightedPreference,
} from "@/types/blend";
import { FilmCarousel } from "@/components/FilmCarousel";
import { RecommendationDeck } from "@/components/RecommendationDeck";

function SectionHeader({
  kicker,
  title,
  note,
}: {
  kicker: string;
  title: string;
  note?: string;
}) {
  return (
    <div>
      <div className="kicker">{kicker}</div>
      <h3 className="mt-2 text-[clamp(34px,5vw,64px)] uppercase leading-[0.86] tracking-[-0.07em] text-ink">
        {title}
      </h3>
      {note && <p className="mt-3 max-w-[60ch] text-[15px] leading-[1.4] text-muted">{note}</p>}
    </div>
  );
}

function ScoreBoard({
  name1,
  name2,
  movieScore,
  genreScore,
  watchedCount,
  highlyRatedCount,
  bridgeCount,
}: {
  name1: string;
  name2: string;
  movieScore: number;
  genreScore: number;
  watchedCount: number;
  highlyRatedCount: number;
  bridgeCount: number;
}) {
  return (
    <div className="grid grid-rows-[1fr_auto] border border-ink bg-cream">
      <div className="flex min-h-[420px] flex-col justify-between p-7">
        <div>
          <div className="kicker">
            {name1} × {name2}
          </div>
          <div className="mt-2 text-[clamp(110px,16vw,240px)] font-black leading-[0.72] tracking-[-0.12em]">
            {movieScore}%
          </div>
        </div>
        <p className="max-w-[44ch] text-[clamp(17px,2vw,26px)] leading-[1.04] tracking-[-0.04em] text-muted">
          {movieScore < 25
            ? "A narrow overlap, which means the recommendations behave like a bridge, not a popularity list."
            : "A strong overlap — the shared shortlist below should feel immediately watchable."}
        </p>
      </div>
      <div>
        <div className="flex items-center justify-between border-t border-ink px-5 py-4 text-[13px] uppercase tracking-[0.08em]">
          <span>Movie match</span>
          <span>{watchedCount} films watched by both</span>
        </div>
        <div className="grid grid-cols-1 border-t border-ink sm:grid-cols-3">
          <div className="border-b border-ink p-4 sm:border-b-0 sm:border-r">
            <b className="text-4xl tracking-[-0.07em]">{genreScore}%</b>
            <span className="mt-1.5 block text-xs uppercase tracking-[0.08em] text-muted">
              Genre match
            </span>
          </div>
          <div className="border-b border-ink p-4 sm:border-b-0 sm:border-r">
            <b className="text-4xl tracking-[-0.07em]">{highlyRatedCount}</b>
            <span className="mt-1.5 block text-xs uppercase tracking-[0.08em] text-muted">
              4★+ shared films
            </span>
          </div>
          <div className="p-4">
            <b className="text-4xl tracking-[-0.07em]">{bridgeCount}</b>
            <span className="mt-1.5 block text-xs uppercase tracking-[0.08em] text-muted">
              Bridge picks
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchCard({
  label,
  preference,
}: {
  label: string;
  preference: WeightedPreference | null;
}) {
  return (
    <article className="border border-ink bg-paper p-6">
      <div className="kicker">{label}</div>
      {preference ? (
        <>
          <h3 className="mt-3 text-[clamp(30px,3.6vw,52px)] uppercase capitalize leading-[0.9] tracking-[-0.06em]">
            {preference.name}
          </h3>
          <p className="mt-3 text-[13px] uppercase tracking-[0.06em] text-muted">
            Rank #{preference.user1Rank ?? preference.rank} & #
            {preference.user2Rank ?? preference.rank} · ★{" "}
            {preference.avgRating.toFixed(1)} avg · {preference.count} films
          </p>
        </>
      ) : (
        <p className="mt-3 text-[15px] text-muted">No overlap detected yet.</p>
      )}
    </article>
  );
}

function TasteLines({ genres }: { genres: WeightedPreference[] }) {
  const max = genres[0]?.score ?? 1;

  return (
    <div className="grid gap-px border border-ink bg-ink">
      {genres.map((g) => {
        const pct = Math.max(8, Math.round((g.score / max) * 100));
        return (
          <div
            key={g.name}
            className="grid min-h-[76px] grid-cols-1 items-center bg-paper sm:grid-cols-[180px_1fr_76px]"
          >
            <div className="p-4 text-xs uppercase capitalize tracking-[0.08em] text-muted">
              {g.name}
            </div>
            <div className="relative h-10 overflow-hidden border-y border-ink bg-paper2 sm:h-full sm:border-x sm:border-y-0">
              <span
                className="absolute inset-y-0 left-0 bg-ink"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="px-4 py-2 text-left text-xl font-bold tracking-[-0.06em] sm:text-center">
              {pct}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ title, note }: { title: string; note: string }) {
  return (
    <div className="grid min-h-[300px] place-items-center border border-ink bg-paper text-center">
      <div className="max-w-[640px] p-10">
        <h3 className="text-[clamp(44px,8vw,110px)] uppercase leading-[0.78] tracking-[-0.09em]">
          {title}
        </h3>
        <p className="mx-auto mt-6 max-w-[520px] text-[17px] leading-[1.35] text-muted">
          {note}
        </p>
      </div>
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
  const highlyRated = taste.commonHighlyRated ?? [];
  const recommendations = results.recommendations ?? [];
  const sharedGenres = taste.sharedGenresRanked ?? [];

  return (
    <div>
      {/* Overview */}
      <section id="blend" className="border-b border-ink px-6 py-10 sm:px-10">
        <SectionHeader kicker="Your blend is ready" title="The result, in full." />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.05fr]">
          <ScoreBoard
            name1={name1}
            name2={name2}
            movieScore={results.movieMatch.score}
            genreScore={results.genreMatch.overlapScore}
            watchedCount={results.movieMatch.commonWatched.length}
            highlyRatedCount={highlyRated.length}
            bridgeCount={recommendations.length}
          />
          <div className="flex flex-col gap-4">
            <MatchCard label="Top shared genre" preference={taste.topSharedGenre} />
            <MatchCard
              label="Top shared director"
              preference={taste.topSharedDirector}
            />
          </div>
        </div>
      </section>

      {/* Shared films */}
      <section id="films" className="border-b border-ink px-6 py-10 sm:px-10">
        <SectionHeader
          kicker="Shared watchlist"
          title={`${results.movieMatch.commonWatchlist.length} films on both watchlists`}
          note="The collection both of you already want to see."
        />
        <div className="mt-7">
          {results.movieMatch.commonWatchlist.length > 0 ? (
            <FilmCarousel
              films={results.movieMatch.commonWatchlist}
              emptyMessage=""
            />
          ) : (
            <EmptyState
              title="Nothing overlaps yet."
              note="No films are on both watchlists. Build a shortlist from the recommendations below, or re-sync both accounts."
            />
          )}
        </div>

        <div className="mt-12">
          <SectionHeader
            kicker="Movie match"
            title={`${results.movieMatch.commonWatched.length} films you both watched`}
          />
          <div className="mt-7">
            <FilmCarousel
              films={results.movieMatch.commonWatched}
              emptyMessage="No overlapping watched films yet."
            />
          </div>
        </div>

        {/* Highly rated by both */}
        <div className="mt-12 grid gap-px border border-ink bg-ink lg:grid-cols-2">
          <div className="flex flex-col justify-between gap-6 bg-ink p-7 text-paper">
            <div>
              <div className="kicker !text-paper/60">Highly rated by both</div>
              <h3 className="mt-3 text-[clamp(34px,4vw,64px)] uppercase leading-[0.84] tracking-[-0.07em]">
                {highlyRated.length > 0
                  ? "Films you both loved."
                  : "No mutual high ratings yet."}
              </h3>
            </div>
            <p className="text-[15px] leading-[1.38] text-paper/70">
              The strongest signal in your blend — films you both rated four
              stars or higher.
            </p>
          </div>
          <div className="bg-paper p-7">
            <FilmCarousel
              films={highlyRated}
              emptyMessage="No overlapping high-rated films found."
            />
          </div>
        </div>
      </section>

      {/* Taste profile */}
      <section id="taste" className="border-b border-ink px-6 py-10 sm:px-10">
        <SectionHeader
          kicker="Common taste profile"
          title="Your shared cinematic DNA."
          note={
            taste.enrichmentCoverage.total > 0
              ? `Weighted from your watched films by rating and frequency — based on ${taste.enrichmentCoverage.enriched} of ${taste.enrichmentCoverage.total} logged films.`
              : "Weighted from your watched films by rating and frequency."
          }
        />
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="flex flex-col justify-between gap-6 border border-ink bg-paper p-7">
            <div>
              <div className="kicker">Shared core</div>
              <h3 className="mt-3 text-[clamp(32px,3.6vw,56px)] uppercase leading-[0.86] tracking-[-0.07em]">
                {sharedGenres.length > 0
                  ? `${sharedGenres.length} shared genres`
                  : "No shared genre core yet."}
              </h3>
            </div>
            <div className="flex flex-col gap-2 border-t border-ink pt-4 text-xs uppercase tracking-[0.08em] sm:flex-row sm:justify-between">
              <span>
                Top genre: {taste.topSharedGenre?.name ?? "none detected"}
              </span>
              <span>
                Top director: {taste.topSharedDirector?.name ?? "none detected"}
              </span>
            </div>
          </div>
          {sharedGenres.length > 0 ? (
            <TasteLines genres={sharedGenres.slice(0, 5)} />
          ) : (
            <EmptyState
              title="Across distance."
              note="Filmblend recommends by pairing one user's known likes with the other's emotional anchors."
            />
          )}
        </div>
      </section>

      {/* Recommendations */}
      <section id="recs" className="border-b border-ink px-6 py-10 sm:px-10">
        <SectionHeader
          kicker="Recommended for both"
          title="Hand-picked bridge films."
          note="New discoveries from your shared taste — excluding everything either of you has watched or saved. Click a title to inspect it."
        />
        <div className="mt-8">
          <RecommendationDeck
            films={recommendations}
            emptyMessage="Add a TMDB API key to enable personalized recommendations."
          />
        </div>
      </section>
    </div>
  );
}
