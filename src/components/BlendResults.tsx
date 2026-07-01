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
      <h3 className="mt-2 text-[clamp(26px,3.8vw,44px)] uppercase leading-[0.94] tracking-[-0.055em] text-ink">
        {title}
      </h3>
      {note && <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.4] text-muted">{note}</p>}
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
      <div className="flex min-h-[310px] flex-col justify-between p-6">
        <div>
          <div className="kicker">
            {name1} × {name2}
          </div>
          <div className="mt-2 overflow-hidden text-[clamp(76px,12vw,150px)] font-black leading-[0.8] tracking-[-0.1em]">
            {movieScore}%
          </div>
        </div>
        <p className="max-w-[34ch] text-[15px] leading-[1.35] text-muted">
          {movieScore < 25
            ? "Narrow overlap. Better bridge picks."
            : "Strong overlap. Easy shared picks."}
        </p>
      </div>
      <div>
        <div className="flex items-center justify-between border-t border-ink px-4 py-3 text-[12px] uppercase tracking-[0.08em]">
          <span>Movie match</span>
          <span>{watchedCount} watched</span>
        </div>
        <div className="grid grid-cols-1 border-t border-ink sm:grid-cols-3">
          <div className="border-b border-ink p-3.5 sm:border-b-0 sm:border-r">
            <b className="text-3xl tracking-[-0.06em]">{genreScore}%</b>
            <span className="mt-1.5 block text-xs uppercase tracking-[0.08em] text-muted">
              Genres
            </span>
          </div>
          <div className="border-b border-ink p-3.5 sm:border-b-0 sm:border-r">
            <b className="text-3xl tracking-[-0.06em]">{highlyRatedCount}</b>
            <span className="mt-1.5 block text-xs uppercase tracking-[0.08em] text-muted">
              Loved
            </span>
          </div>
          <div className="p-3.5">
            <b className="text-3xl tracking-[-0.06em]">{bridgeCount}</b>
            <span className="mt-1.5 block text-xs uppercase tracking-[0.08em] text-muted">
              Picks
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
    <article className="border border-ink bg-paper p-5">
      <div className="kicker">{label}</div>
      {preference ? (
        <>
          <h3 className="mt-2 text-[clamp(24px,3vw,36px)] uppercase capitalize leading-[0.96] tracking-[-0.05em]">
            {preference.name}
          </h3>
          <p className="mt-2 text-[12px] uppercase tracking-[0.06em] text-muted">
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
            className="grid min-h-[58px] grid-cols-1 items-center bg-paper sm:grid-cols-[150px_1fr_58px]"
          >
            <div className="p-3 text-xs uppercase capitalize tracking-[0.08em] text-muted">
              {g.name}
            </div>
            <div className="relative h-7 overflow-hidden border-y border-ink bg-paper2 sm:h-full sm:border-x sm:border-y-0">
              <span
                className="absolute inset-y-0 left-0 bg-ink"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="px-3 py-2 text-left text-base font-bold tracking-[-0.04em] sm:text-center">
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
    <div className="grid min-h-[220px] place-items-center border border-ink bg-paper text-center">
      <div className="max-w-[520px] p-8">
        <h3 className="overflow-hidden text-[clamp(30px,5vw,56px)] uppercase leading-[0.9] tracking-[-0.06em]">
          {title}
        </h3>
        <p className="mx-auto mt-3 max-w-[420px] text-[14px] leading-[1.4] text-muted">
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
      <section id="blend" className="border-b border-ink px-6 py-8 sm:px-10">
        <SectionHeader kicker="Blend ready" title="Results" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.05fr]">
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
      <section id="films" className="border-b border-ink px-6 py-8 sm:px-10">
        <SectionHeader
          kicker="Watchlist"
          title={`${results.movieMatch.commonWatchlist.length} saved by both`}
        />
        <div className="mt-5 min-w-0 max-w-full">
          {results.movieMatch.commonWatchlist.length > 0 ? (
            <FilmCarousel
              films={results.movieMatch.commonWatchlist}
              emptyMessage=""
            />
          ) : (
            <EmptyState
              title="No shared saves"
              note="Try the recommendations below."
            />
          )}
        </div>

        <div className="mt-10">
          <SectionHeader
            kicker="Movie match"
            title={`${results.movieMatch.commonWatched.length} watched by both`}
          />
          <div className="mt-5 min-w-0 max-w-full">
            <FilmCarousel
              films={results.movieMatch.commonWatched}
              emptyMessage="No overlapping watched films yet."
            />
          </div>
        </div>

        {/* Highly rated by both */}
        <div className="mt-10 min-w-0 grid gap-px border border-ink bg-ink lg:grid-cols-[0.75fr_1.25fr]">
          <div className="flex flex-col justify-between gap-6 bg-ink p-6 text-paper">
            <div>
              <div className="kicker !text-paper/60">Highly rated by both</div>
              <h3 className="mt-2 text-[clamp(26px,3.2vw,42px)] uppercase leading-[0.92] tracking-[-0.055em]">
                {highlyRated.length > 0
                  ? "Both loved"
                  : "None yet"}
              </h3>
            </div>
          </div>
          <div className="min-w-0 max-w-full bg-paper p-5">
            <FilmCarousel
              films={highlyRated}
              emptyMessage="No overlapping high-rated films found."
            />
          </div>
        </div>
      </section>

      {/* Taste profile */}
      <section id="taste" className="border-b border-ink px-6 py-8 sm:px-10">
        <SectionHeader
          kicker="Taste"
          title="Shared signals"
          note={
            taste.enrichmentCoverage.total > 0
              ? `${taste.enrichmentCoverage.enriched}/${taste.enrichmentCoverage.total} films enriched.`
              : undefined
          }
        />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col justify-between gap-6 border border-ink bg-paper p-5">
            <div>
              <div className="kicker">Shared core</div>
              <h3 className="mt-2 text-[clamp(25px,3vw,38px)] uppercase leading-[0.95] tracking-[-0.055em]">
                {sharedGenres.length > 0
                  ? `${sharedGenres.length} shared genres`
                  : "No genre core yet"}
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
              title="Still forming"
              note="More public activity will sharpen the blend."
            />
          )}
        </div>
      </section>

      {/* Recommendations */}
      <section id="recs" className="border-b border-ink px-6 py-8 sm:px-10">
        <SectionHeader
          kicker="Recommendations"
          title="Bridge picks"
        />
        <div className="mt-6">
          <RecommendationDeck
            films={recommendations}
            emptyMessage="Add a TMDB API key to enable personalized recommendations."
          />
        </div>
      </section>
    </div>
  );
}
