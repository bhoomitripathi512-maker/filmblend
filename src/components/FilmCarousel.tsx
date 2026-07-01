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
    <div className="max-w-full min-w-0 touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch] flex snap-x snap-mandatory items-stretch gap-2.5 overflow-x-auto pb-2">
      {films.map((film) => {
        const poster = posterUrl(film.posterPath);

        return (
          <div
            key={`${film.slug}-${film.tmdbId ?? "local"}`}
            className="w-[132px] shrink-0 snap-start sm:w-[148px] md:w-[164px] lg:w-[176px]"
          >
            <article className="flex h-full flex-col overflow-hidden border border-ink bg-paper">
              <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden bg-ink">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={poster}
                    alt={film.title}
                    className="absolute inset-0 h-full w-full object-cover object-center [filter:saturate(0.92)]"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-paper/70">
                    {film.title}
                  </div>
                )}
                {"rating" in film && film.rating !== undefined && (
                  <span className="absolute right-2 top-2 z-10 border border-ink bg-paper px-1.5 py-1 text-[11px] tracking-[0.05em] text-ink">
                    ★{film.rating}
                  </span>
                )}
              </div>
              <div className="flex min-h-[4.25rem] flex-col justify-start px-2.5 pb-3 pt-2.5">
                <h3 className="m-0 line-clamp-2 min-h-[2rem] text-[14px] leading-[1.05] tracking-[-0.04em] text-ink">
                  {film.title}
                </h3>
                <p className="mt-1.5 min-h-[1rem] text-[11px] uppercase tracking-[0.06em] text-muted">
                  {film.year ?? ""}
                </p>
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
