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
      <div className="border border-ink bg-cream p-5">
        <label className="m-0">{label}</label>
        <p className="mt-2 text-3xl tracking-[-0.05em] text-ink">@{username}</p>
        <p className="mt-2 text-sm text-green">Connected and synced</p>
        <button
          type="button"
          onClick={() => handleConnect()}
          disabled={loading}
          className="mt-4 text-xs uppercase tracking-[0.08em] text-green underline-offset-2 hover:underline disabled:opacity-50"
        >
          {loading ? "Re-syncing…" : "Re-sync Letterboxd"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleConnect} className="border border-ink bg-paper p-5">
      <label>{label}</label>
      <p className="mt-1 text-[13px] leading-[1.35] text-muted">
        Enter your public Letterboxd username. Your watchlist and watched films
        must be public.
      </p>
      <div className="mt-5">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          className="w-full border-0 border-b border-ink bg-transparent pb-2.5 pt-3 text-2xl tracking-[-0.045em] text-ink outline-none placeholder:text-soft"
          required
          disabled={loading}
        />
      </div>
      <div className="mt-5 flex items-center justify-end">
        <button
          type="submit"
          disabled={loading || !username.trim()}
          className="btn fill"
        >
          {loading ? "Syncing…" : "Connect"}
        </button>
      </div>
      {error && (
        <p className="mt-3 border border-ink bg-paper2 px-3 py-2 text-[13px] text-muted">
          {error}
        </p>
      )}
    </form>
  );
}
