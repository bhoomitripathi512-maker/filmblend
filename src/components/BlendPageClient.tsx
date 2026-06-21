"use client";

import { useCallback, useEffect, useState } from "react";
import { ConnectLetterboxd } from "@/components/ConnectLetterboxd";
import { BlendResultsView } from "@/components/BlendResults";
import { BlendLoading } from "@/components/BlendLoading";
import type { Blend } from "@/types/blend";

async function fetchBlend(slug: string): Promise<Blend> {
  const response = await fetch(`/api/blends/${slug}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load blend");
  }
  return data;
}

export function BlendPageClient({ slug }: { slug: string }) {
  const [blend, setBlend] = useState<Blend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBlend(slug);
      setBlend(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load blend");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    let active = true;

    fetchBlend(slug)
      .then((data) => {
        if (active) {
          setBlend(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load blend");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return <BlendLoading />;
  }

  if (error || !blend) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <p className="text-red-300">{error ?? "Blend not found"}</p>
      </div>
    );
  }

  const p1 = blend.participants.find((p) => p.slot === 1);
  const p2 = blend.participants.find((p) => p.slot === 2);
  const isComplete = blend.participants.length === 2 && blend.results;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <div className="text-center">
        <p className="eyebrow text-sm font-semibold text-lb-green">Film Blend</p>
        <h1 className="mt-2 text-3xl font-bold text-lb-white">
          {isComplete ? "Your blend is ready" : "Connect Letterboxd"}
        </h1>
        {!isComplete && (
          <p className="mt-3 text-lb-fog">
            Both people need to connect their Letterboxd accounts to see your
            shared taste.
          </p>
        )}
      </div>

      {!isComplete && (
        <div className="grid gap-4 md:grid-cols-2">
          <ConnectLetterboxd
            slot={1}
            slug={slug}
            label="Person 1"
            existingUsername={p1?.letterboxdUsername}
            onConnected={refresh}
          />
          <ConnectLetterboxd
            slot={2}
            slug={slug}
            label="Person 2"
            existingUsername={p2?.letterboxdUsername}
            onConnected={refresh}
          />
        </div>
      )}

      {isComplete && (
        <div className="grid gap-4 md:grid-cols-2">
          <ConnectLetterboxd
            slot={1}
            slug={slug}
            label="Person 1"
            existingUsername={p1?.letterboxdUsername}
            onConnected={refresh}
          />
          <ConnectLetterboxd
            slot={2}
            slug={slug}
            label="Person 2"
            existingUsername={p2?.letterboxdUsername}
            onConnected={refresh}
          />
        </div>
      )}

      {!isComplete && (
        <div className="rounded-xl border border-lb-graphite bg-lb-carbon p-5">
          <p className="text-sm font-medium text-lb-pewter">Share this link</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={blend.shareUrl}
              className="flex-1 rounded-lg border border-lb-graphite bg-lb-void px-4 py-2 text-sm text-lb-pewter"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(blend.shareUrl)}
              className="rounded-lg border border-lb-graphite px-4 py-2 text-sm text-lb-white hover:border-lb-fog"
            >
              Copy link
            </button>
          </div>
        </div>
      )}

      {isComplete && blend.results && (
        <BlendResultsView results={blend.results} participants={blend.participants} />
      )}
    </div>
  );
}
