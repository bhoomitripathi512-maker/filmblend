"use client";

import { useCallback, useEffect, useState } from "react";
import { posterUrl } from "@/lib/tmdb/client";
import type { RecommendedFilm } from "@/types/blend";

export function RecommendationDeck({
  films,
  emptyMessage,
}: {
  films: RecommendedFilm[];
  emptyMessage: string;
}) {
  const [index, setIndex] = useState(0);

  const current = films[index];

  const goNext = useCallback(() => {
    if (films.length === 0) return;
    setIndex((prev) => (prev + 1) % films.length);
  }, [films.length]);

  const goPrev = useCallback(() => {
    if (films.length === 0) return;
    setIndex((prev) => (prev - 1 + films.length) % films.length);
  }, [films.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev]);

  if (films.length === 0) {
    return <p className="text-sm text-lb-fog">{emptyMessage}</p>;
  }

  if (!current) return null;

  const poster = posterUrl(current.posterPath, "w500");

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-lb-graphite bg-lb-carbon">
        <div className="grid gap-0 md:grid-cols-[minmax(0,280px)_1fr]">
          <div className="relative aspect-[2/3] bg-lb-void md:aspect-auto md:min-h-[420px]">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt={current.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full min-h-[320px] items-center justify-center p-6 text-center text-lb-fog">
                {current.title}
              </div>
            )}
            <span className="absolute right-3 top-3 rounded-full bg-lb-green px-3 py-1 text-xs font-bold text-lb-void">
              {current.matchScore}% match
            </span>
          </div>

          <div className="flex flex-col justify-between p-6 md:p-8">
            <div>
              <p className="eyebrow text-xs font-semibold text-lb-green">
                {current.explanation.headline}
              </p>
              <h4 className="mt-3 text-2xl font-bold text-lb-white">
                {current.title}
                {current.year ? (
                  <span className="ml-2 text-lg font-normal text-lb-fog">
                    {current.year}
                  </span>
                ) : null}
              </h4>
              <p className="mt-4 text-sm leading-relaxed text-lb-pewter">
                {current.explanation.summary}
              </p>

              {current.explanation.tasteSignals.length > 0 && (
                <div className="mt-5">
                  <p className="eyebrow text-[10px] text-lb-fog">Taste signals</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {current.explanation.tasteSignals.map((signal) => (
                      <span
                        key={signal}
                        className="rounded-full border border-lb-graphite px-3 py-1 text-xs text-lb-pewter"
                      >
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {current.explanation.tmdbSignals.length > 0 && (
                <div className="mt-4">
                  <p className="eyebrow text-[10px] text-lb-fog">Why TMDB picked this</p>
                  <ul className="mt-2 space-y-1 text-xs text-lb-fog">
                    {current.explanation.tmdbSignals.map((signal) => (
                      <li key={signal}>· {signal}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-lb-fog">
                Pick {index + 1} of {films.length}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  className="rounded-lg border border-lb-graphite px-4 py-2 text-sm text-lb-pewter transition hover:border-lb-fog hover:text-lb-white"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-lg bg-lb-green px-5 py-2 text-sm font-semibold text-lb-void transition hover:bg-lb-green-dim"
                >
                  Try another pick
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
