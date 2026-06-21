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

  async function handleConnect(e?: React.FormEvent) {
    e?.preventDefault();
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
      <div className="rounded-xl border border-lb-green/40 bg-lb-carbon p-5">
        <p className="text-sm font-medium text-lb-green">{label}</p>
        <p className="mt-1 text-lg font-semibold text-lb-white">@{username}</p>
        <p className="mt-2 text-sm text-lb-fog">Connected and synced</p>
        <button
          type="button"
          onClick={() => handleConnect()}
          disabled={loading}
          className="mt-4 text-sm text-lb-green underline-offset-2 hover:underline disabled:opacity-50"
        >
          {loading ? "Re-syncing…" : "Re-sync Letterboxd"}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleConnect}
      className="rounded-xl border border-lb-graphite bg-lb-carbon p-5"
    >
      <p className="text-sm font-medium text-lb-pewter">{label}</p>
      <p className="mt-1 text-xs text-lb-fog">
        Enter your public Letterboxd username. Your watchlist and watched films
        must be public.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="letterboxd username"
          className="flex-1 rounded-lg border border-lb-graphite bg-lb-void px-4 py-3 text-lb-white placeholder:text-lb-graphite focus:border-lb-green focus:outline-none"
          required
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !username.trim()}
          className="rounded-lg bg-lb-green px-5 py-3 font-semibold text-lb-void transition hover:bg-lb-green-dim disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Syncing…" : "Connect"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </form>
  );
}
