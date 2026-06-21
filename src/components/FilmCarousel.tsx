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
    return <p className="text-sm text-lb-fog">{emptyMessage}</p>;
  }

  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 scrollbar-thin">
      {films.map((film) => {
        const poster = posterUrl(film.posterPath);

        return (
          <div
            key={`${film.slug}-${film.tmdbId ?? "local"}`}
            className="w-[calc(50%-0.375rem)] shrink-0 snap-start sm:w-[calc(33.333%-0.5rem)] md:w-[calc(25%-0.5625rem)] lg:w-[calc(16.666%-0.625rem)]"
          >
            <div className="overflow-hidden rounded-sm border border-lb-graphite bg-lb-carbon">
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
          </div>
        );
      })}
    </div>
  );
}
