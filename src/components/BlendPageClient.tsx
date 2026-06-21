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
      <div className="px-6 py-16">
        <div className="mx-auto max-w-xl border border-ink bg-paper2 p-6 text-center">
          <p className="text-ink">{error ?? "Blend not found"}</p>
        </div>
      </div>
    );
  }

  const p1 = blend.participants.find((p) => p.slot === 1);
  const p2 = blend.participants.find((p) => p.slot === 2);
  const isComplete = blend.participants.length === 2 && blend.results;

  if (isComplete && blend.results) {
    return (
      <div>
        <BlendResultsView
          results={blend.results}
          participants={blend.participants}
        />
        <section className="border-t border-ink px-6 py-8 sm:px-10">
          <div className="kicker">Refresh data</div>
          <h3 className="mt-2 text-3xl uppercase leading-[0.9] tracking-[-0.06em]">
            Re-sync profiles
          </h3>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
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
        </section>
      </div>
    );
  }

  return (
    <section className="grid min-h-[calc(100vh-64px)] grid-cols-1 border-b border-ink lg:grid-cols-[minmax(250px,330px)_1fr]">
      <aside className="flex flex-col justify-between gap-8 border-b border-ink bg-paper2/45 px-7 py-8 lg:border-b-0 lg:border-r">
        <div>
          <div className="kicker">Connect Letterboxd</div>
          <h2 className="mt-3 text-2xl leading-[0.96] tracking-[-0.06em]">
            Both people connect to reveal the blend.
          </h2>
          <p className="mt-3.5 max-w-[31ch] text-[15px] leading-[1.45] text-muted">
            Each person enters their public Letterboxd handle. Share the link so
            the second person can join from any device.
          </p>
        </div>
        <div className="kicker">Screen 02 / Connect</div>
      </aside>

      <div className="p-6 sm:p-10">
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

        <div className="relative z-10 mt-8 border border-ink bg-paper p-5">
          <label htmlFor={`share-${slug}`}>Share this link</label>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              id={`share-${slug}`}
              readOnly
              value={blend.shareUrl}
              className="flex-1 border border-ink bg-paper2 px-4 py-2.5 text-sm text-ink"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(blend.shareUrl)}
              className="btn"
            >
              Copy link
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
