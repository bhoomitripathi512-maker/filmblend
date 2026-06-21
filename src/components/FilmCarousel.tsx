import { posterUrl } from "@/lib/tmdb/client";
import type { EnrichedFilm, RecommendedFilm } from "@/types/blend";

type CarouselFilm = EnrichedFilm | RecommendedFilm;

export function FilmCarousel({
  films,
  emptyMessage,
}: {
  films: CarouselFilm[];
  emptyMessage: string;
}) {
  if (films.length === 0) {
    return <p className="text-sm text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
      {films.map((film) => {
        const poster = posterUrl(film.posterPath);

        return (
          <div
            key={`${film.slug}-${film.tmdbId ?? "local"}`}
            className="w-[calc(50%-0.375rem)] shrink-0 snap-start sm:w-[calc(33.333%-0.5rem)] md:w-[calc(25%-0.5625rem)] lg:w-[calc(16.666%-0.625rem)]"
          >
            <article className="grid h-full grid-rows-[auto_1fr] border border-ink bg-paper">
              <div className="relative aspect-[2/3] bg-ink">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={poster}
                    alt={film.title}
                    className="h-full w-full object-cover [filter:saturate(0.92)]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-3 text-center text-xs text-paper/70">
                    {film.title}
                  </div>
                )}
                {"rating" in film && film.rating !== undefined && (
                  <span className="absolute right-2.5 top-2.5 border border-ink bg-paper px-1.5 py-1 text-[11px] tracking-[0.05em] text-ink">
                    ★{film.rating}
                  </span>
                )}
              </div>
              <div className="px-3 pb-4 pt-3">
                <h3 className="m-0 truncate text-[15px] leading-none tracking-[-0.045em] text-ink">
                  {film.title}
                </h3>
                {film.year && (
                  <p className="mt-1.5 text-[11px] uppercase tracking-[0.06em] text-muted">
                    {film.year}
                  </p>
                )}
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
