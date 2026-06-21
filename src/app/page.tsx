"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createBlend() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/blends", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create blend");
      }

      router.push(`/blend/${data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <section className="grid min-h-[calc(100vh-64px)] grid-cols-1 border-b border-ink lg:grid-cols-[minmax(250px,330px)_1fr]">
      <aside className="flex flex-col justify-between gap-8 border-b border-ink bg-paper2/45 px-7 py-8 lg:border-b-0 lg:border-r">
        <div>
          <div className="kicker">Film matching for cinephiles</div>
          <h2 className="mt-3 text-2xl leading-[0.96] tracking-[-0.06em]">
            A quieter, cleaner way to compare taste.
          </h2>
          <p className="mt-3.5 max-w-[31ch] text-[15px] leading-[1.45] text-muted">
            Fewer gimmicks, stronger hierarchy, and more room for the films to
            breathe.
          </p>
        </div>
        <div className="kicker">Screen 01 / Entry</div>
      </aside>

      <div className="relative overflow-hidden p-6 sm:p-10">
        <div className="grid h-full items-stretch gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col">
            <h1 className="m-0 text-[clamp(58px,10.8vw,140px)] uppercase leading-[0.79] tracking-[-0.085em]">
              Find the film between two tastes.
            </h1>
            <p className="mt-7 max-w-[780px] text-[clamp(18px,2.1vw,28px)] leading-[1.03] tracking-[-0.04em]">
              Enter two Letterboxd handles. Filmblend turns overlap, ratings,
              watchlists, and hidden affinities into a curated double-feature
              shortlist.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <span className="pill green">Taste blend</span>
              <span className="pill">Letterboxd import</span>
              <span className="pill">Curated picks</span>
            </div>

            <div className="relative z-10 mt-9 max-w-[620px] border border-ink bg-paper p-5">
              <p className="text-[15px] leading-[1.4] text-muted">
                Create a blend link, send it to a friend, and connect your
                Letterboxd profiles to reveal your shared cinematic taste.
              </p>
              <div className="mt-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <span className="max-w-[34ch] text-[13px] leading-[1.35] text-muted">
                  Works on any device. Your blends are saved in the cloud.
                </span>
                <button
                  type="button"
                  onClick={createBlend}
                  disabled={loading}
                  className="btn fill shrink-0"
                >
                  {loading ? "Creating…" : "Create blend"}
                </button>
              </div>
              {error && (
                <p className="mt-4 border border-ink bg-paper2 px-3 py-2 text-[13px] text-muted">
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="pointer-events-none relative hidden min-h-[600px] overflow-hidden border border-ink bg-ink lg:block">
            <div className="absolute inset-0 bg-gradient-to-br from-green2 via-ink to-ink" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-black/10" />
            <div className="absolute inset-x-6 bottom-6 z-[2] flex items-end justify-between gap-5 text-paper">
              <div>
                <h3 className="m-0 text-5xl uppercase leading-[0.88] tracking-[-0.065em]">
                  Sentimental Value
                </h3>
                <p className="mt-2 text-[13px] uppercase tracking-[0.08em] opacity-80">
                  Shared 5-star energy
                </p>
              </div>
              <span className="pill border-paper text-paper">2025</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
