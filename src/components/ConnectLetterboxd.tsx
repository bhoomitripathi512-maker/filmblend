"use client";

import { useState } from "react";

interface ConnectLetterboxdProps {
  slot: 1 | 2;
  slug: string;
  label: string;
  onConnected: () => void;
  existingUsername?: string | null;
}

export function ConnectLetterboxd({
  slot,
  slug,
  label,
  onConnected,
  existingUsername,
}: ConnectLetterboxdProps) {
  const [username, setUsername] = useState(existingUsername ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(Boolean(existingUsername));

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/blends/${slug}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, slot }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to connect");
      }

      setSuccess(true);
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
        <p className="text-sm font-medium text-emerald-300">{label}</p>
        <p className="mt-1 text-lg font-semibold text-white">@{username}</p>
        <p className="mt-2 text-sm text-emerald-200/80">Connected and synced</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleConnect}
      className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
    >
      <p className="text-sm font-medium text-zinc-300">{label}</p>
      <p className="mt-1 text-xs text-zinc-500">
        Enter your public Letterboxd username. Your watchlist and watched films
        must be public.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="letterboxd username"
          className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-orange-400 focus:outline-none"
          required
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !username.trim()}
          className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Syncing…" : "Connect"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </form>
  );
}
