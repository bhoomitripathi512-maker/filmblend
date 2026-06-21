"use client";

import { useState } from "react";
import { posterUrl } from "@/lib/tmdb/client";
import type { RecommendedFilm } from "@/types/blend";

function letterboxdUrl(film: RecommendedFilm): string {
  const slug = film.slug.startsWith("tmdb-") ? null : film.slug;
  return slug
    ? `https://letterboxd.com/film/${slug}/`
    : `https://letterboxd.com/search/${encodeURIComponent(film.title)}/`;
}

function selectRecommendation(
  event: React.KeyboardEvent<HTMLDivElement>,
  onSelect: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect();
  }
}

export function RecommendationDeck({
  films,
  emptyMessage,
}: {
  films: RecommendedFilm[];
  emptyMessage: string;
}) {
  const [index, setIndex] = useState(0);

  if (films.length === 0) {
    return <p className="text-sm text-muted">{emptyMessage}</p>;
  }

  const current = films[Math.min(index, films.length - 1)];
  const detailPoster = posterUrl(current.posterPath, "w500");
  const signals = [
    ...current.explanation.tasteSignals,
    ...current.explanation.tmdbSignals,
  ].slice(0, 3);

  return (
    <div className="grid min-h-[600px] grid-cols-1 gap-px border border-ink bg-ink lg:grid-cols-[1.1fr_0.9fr]">
      {/* Master list */}
      <div className="max-h-[640px] overflow-auto bg-paper">
        {films.map((film, i) => {
          const active = i === index;
          const poster = posterUrl(film.posterPath);
          return (
            <div
              key={`${film.slug}-${film.tmdbId ?? i}`}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              onClick={() => setIndex(i)}
              onKeyDown={(event) => selectRecommendation(event, () => setIndex(i))}
              className={`grid w-full cursor-pointer grid-cols-[56px_1fr_58px] items-center gap-4 border-b border-ink p-3.5 text-left transition-colors duration-150 sm:grid-cols-[72px_1fr_74px] ${
                active ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-ink hover:text-paper"
              }`}
            >
              <div className="aspect-[72/98] w-full overflow-hidden border border-current bg-ink/20">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={poster}
                    alt={film.title}
                    className="pointer-events-none h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[19px] leading-[0.96] tracking-[-0.055em] sm:text-2xl">
                  {film.title}
                </div>
                <div className="mt-1.5 truncate text-[11px] uppercase leading-[1.25] tracking-[0.06em] opacity-60">
                  {film.explanation.tasteSignals[0] ??
                    current.explanation.headline}
                </div>
              </div>
              <div className="border border-current px-2 py-2 text-center text-[15px] tracking-[-0.04em]">
                {film.matchScore}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail pane */}
      <aside className="grid grid-rows-[1fr_auto] bg-paper">
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-[0.82fr_1fr]">
          <div className="min-h-[300px] border border-ink bg-ink sm:min-h-[470px]">
            {detailPoster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={detailPoster}
                alt={current.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-paper/70">
                {current.title}
              </div>
            )}
          </div>
          <div className="flex flex-col justify-between gap-5">
            <div>
              <div className="kicker">
                Recommended · {current.year ?? "—"}
              </div>
              <h3 className="mt-2 overflow-hidden text-[clamp(40px,6vw,80px)] uppercase leading-[0.8] tracking-[-0.085em]">
                {current.title}
              </h3>
              <p className="mt-4 max-w-[48ch] text-[15px] leading-[1.42] text-muted">
                {current.explanation.summary}
              </p>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-5 border-t border-ink pt-2.5 text-xs uppercase tracking-[0.08em]">
                <span>Match score</span>
                <strong>{current.matchScore}%</strong>
              </div>
              {signals.map((signal, i) => (
                <div
                  key={signal}
                  className="flex items-center justify-between gap-5 border-t border-ink pt-2.5 text-xs uppercase tracking-[0.08em]"
                >
                  <span className="text-muted">{signal}</span>
                  <strong>{i === 0 ? "Signal" : "Why"}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="relative z-10 grid grid-cols-1 border-t border-ink sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setIndex((prev) => (prev + 1) % films.length)}
            className="h-[58px] border-b border-ink text-xs uppercase tracking-[0.08em] transition-colors hover:bg-ink hover:text-paper sm:border-b-0 sm:border-r"
          >
            Not this mood
          </button>
          <a
            href={letterboxdUrl(current)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[58px] items-center justify-center text-xs uppercase tracking-[0.08em] transition-colors hover:bg-ink hover:text-paper"
          >
            Open in Letterboxd
          </a>
        </div>
      </aside>
    </div>
  );
}
