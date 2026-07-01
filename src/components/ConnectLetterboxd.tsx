"use client";

import { useEffect, useState } from "react";
import { parseJsonResponse } from "@/lib/api/fetch-json";

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

  useEffect(() => {
    if (existingUsername) {
      setUsername(existingUsername);
      setSuccess(true);
    }
  }, [existingUsername]);

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

      const data = await parseJsonResponse<{ ok?: boolean; error?: string }>(
        response,
      );

      setSuccess(true);
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputId = `letterboxd-${slug}-slot-${slot}`;

  if (success) {
    return (
      <div className="border border-ink bg-cream p-5">
        <p className="m-0 text-xs uppercase tracking-[0.08em] text-muted">{label}</p>
        <p className="mt-2 text-2xl tracking-[-0.045em] text-ink">@{username}</p>
        <p className="mt-1.5 text-xs uppercase tracking-[0.08em] text-green">Synced</p>
        <button
          type="button"
          onClick={() => handleConnect()}
          disabled={loading}
          className="btn mt-4"
        >
          {loading ? "Re-syncing…" : "Re-sync Letterboxd"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleConnect} className="relative z-10 border border-ink bg-paper p-5">
      <label htmlFor={inputId}>{label}</label>
      <div className="mt-5">
        <input
          id={inputId}
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          className="w-full border-0 border-b border-ink bg-transparent pb-2.5 pt-3 text-xl tracking-[-0.04em] text-ink outline-none placeholder:text-soft"
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
