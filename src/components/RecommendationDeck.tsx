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

function shortenSynopsis(text: string | undefined, maxLength = 155): string {
  const normalized = text?.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;

  const sentences = normalized.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [];
  let complete = "";
  for (const sentence of sentences) {
    const next = `${complete} ${sentence.trim()}`.trim();
    if (next.length > maxLength) break;
    complete = next;
  }

  if (complete) return complete;

  const boundary = normalized.lastIndexOf(" ", maxLength - 1);
  const cutAt = boundary > 80 ? boundary : maxLength;
  return `${normalized.slice(0, cutAt).replace(/[,:;–-]\s*$/, "").trim()}...`;
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
  const synopsis = shortenSynopsis(current.overview || current.explanation.summary);

  return (
    <div className="grid min-h-[520px] grid-cols-1 gap-px border border-ink bg-ink lg:grid-cols-[1.05fr_0.95fr]">
      {/* Master list */}
      <div className="max-h-[560px] overflow-auto bg-paper">
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
              className={`grid w-full cursor-pointer grid-cols-[52px_1fr_50px] items-center gap-3 border-b border-ink p-3 text-left transition-colors duration-150 sm:grid-cols-[62px_1fr_58px] ${
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
                <div className="truncate text-[17px] leading-[1] tracking-[-0.045em] sm:text-[20px]">
                  {film.title}
                </div>
                <div className="mt-1 truncate text-[10px] uppercase leading-[1.25] tracking-[0.06em] opacity-60">
                  {film.explanation.tasteSignals[0] ??
                    current.explanation.headline}
                </div>
              </div>
              <div className="border border-current px-2 py-1.5 text-center text-[13px] tracking-[-0.03em]">
                {film.matchScore}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail pane */}
      <aside className="grid grid-rows-[1fr_auto] bg-paper">
        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-[0.78fr_1fr]">
          <div className="min-h-[280px] border border-ink bg-ink sm:min-h-[420px]">
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
                Pick · {current.year ?? "—"}
              </div>
              <h3 className="mt-2 overflow-hidden text-[clamp(30px,4.6vw,58px)] uppercase leading-[0.88] tracking-[-0.065em]">
                {current.title}
              </h3>
              {synopsis && (
                <p className="mt-3 max-w-[48ch] text-[14px] leading-[1.38] text-muted">
                  {synopsis}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-5 border-t border-ink pt-2.5 text-xs uppercase tracking-[0.08em]">
                <span>Match score</span>
                <strong>{current.matchScore}%</strong>
              </div>
            </div>
          </div>
        </div>
        <div className="relative z-10 grid grid-cols-1 border-t border-ink sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setIndex((prev) => (prev + 1) % films.length)}
            className="h-[52px] border-b border-ink text-xs uppercase tracking-[0.08em] transition-colors hover:bg-ink hover:text-paper sm:border-b-0 sm:border-r"
          >
            Next pick
          </button>
          <a
            href={letterboxdUrl(current)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[52px] items-center justify-center text-xs uppercase tracking-[0.08em] transition-colors hover:bg-ink hover:text-paper"
          >
            Letterboxd
          </a>
        </div>
      </aside>
    </div>
  );
}
