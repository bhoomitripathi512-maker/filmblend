"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseJsonResponse } from "@/lib/api/fetch-json";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createBlend() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/blends", { method: "POST" });
      const data = await parseJsonResponse<{ slug?: string; error?: string }>(
        response,
      );

      if (!data.slug) {
        throw new Error(data.error ?? "Failed to create blend");
      }

      router.push(`/blend/${data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <section className="grid min-h-[calc(100dvh-var(--chrome-header)-var(--chrome-footer))] grid-cols-1 border-b border-ink lg:grid-cols-[minmax(220px,300px)_1fr]">
      <aside className="flex flex-col justify-between gap-8 border-b border-ink bg-paper2/35 px-6 py-7 lg:border-b-0 lg:border-r">
        <div>
          <div className="kicker">Film matching</div>
          <h2 className="mt-3 text-xl leading-[1] tracking-[-0.045em]">
            Compare two Letterboxd tastes.
          </h2>
        </div>
      </aside>

      <div className="relative overflow-hidden p-6 sm:p-9">
        <div className="grid h-full items-stretch gap-8">
          <div className="flex flex-col">
            <h1 className="m-0 text-[clamp(42px,8vw,104px)] uppercase leading-[0.86] tracking-[-0.075em]">
              Find a film for both of you.
            </h1>
            <p className="mt-5 max-w-[560px] text-[clamp(16px,1.7vw,21px)] leading-[1.25] tracking-[-0.025em] text-muted">
              Connect two public Letterboxd profiles and get shared watchlist,
              taste, and recommendation picks.
            </p>

            <div className="relative z-10 mt-8 max-w-[520px] border border-ink bg-paper p-5">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <span className="text-[13px] uppercase tracking-[0.08em] text-muted">
                  Create a share link
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
        </div>
      </div>
    </section>
  );
}
