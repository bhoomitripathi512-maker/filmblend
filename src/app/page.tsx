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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-400">
          Filmblend
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Your Letterboxd taste, blended
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-400">
          Create a blend link, send it to a friend, connect your Letterboxd
          profiles, and discover shared movies, genres, and what to watch
          together.
        </p>
      </div>

      <div className="mt-12 space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Shared Watchlist",
              desc: "Films on both watchlists — pick what to watch tonight",
            },
            {
              title: "Taste Match",
              desc: "Common genres, high-rated films, and directors",
            },
            {
              title: "Smart Picks",
              desc: "Recommendations based on what you both love",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <h3 className="font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{item.desc}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={createBlend}
          disabled={loading}
          className="w-full rounded-2xl bg-orange-500 py-4 text-lg font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Creating your blend…" : "Create a blend link"}
        </button>

        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-300">
            {error}
          </p>
        )}

        <p className="text-center text-xs text-zinc-600">
          Requires public Letterboxd profiles. Works on any device — your blends
          are saved in the cloud.
        </p>
      </div>
    </div>
  );
}
