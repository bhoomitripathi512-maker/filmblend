"use client";

import { useCallback, useEffect, useState } from "react";
import { ConnectLetterboxd } from "@/components/ConnectLetterboxd";
import { BlendResultsView } from "@/components/BlendResults";
import { BlendLoading } from "@/components/BlendLoading";
import { useSyncHeaderVariant } from "@/components/SiteHeader";
import { parseJsonResponse } from "@/lib/api/fetch-json";
import type { Blend } from "@/types/blend";

async function fetchBlend(slug: string): Promise<Blend> {
  const response = await fetch(`/api/blends/${slug}`, { cache: "no-store" });
  return parseJsonResponse<Blend>(response);
}

async function computeBlend(slug: string): Promise<Blend> {
  const response = await fetch(`/api/blends/${slug}/compute`, {
    method: "POST",
    cache: "no-store",
  });
  return parseJsonResponse<Blend>(response);
}

async function loadBlendWithResults(slug: string): Promise<Blend> {
  const data = await fetchBlend(slug);
  if (data.participants.length !== 2 || data.results) {
    return data;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await computeBlend(slug);
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  throw lastError;
}

export function BlendPageClient({ slug }: { slug: string }) {
  const [blend, setBlend] = useState<Blend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showResultsHeader =
    !loading &&
    blend !== null &&
    blend.participants.length === 2 &&
    Boolean(blend.results);

  useSyncHeaderVariant(showResultsHeader ? "results" : "minimal");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadBlendWithResults(slug);
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

    loadBlendWithResults(slug)
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
        <section
          id="resync"
          className="relative z-20 scroll-mt-[var(--chrome-header)] border-b border-ink bg-paper px-6 py-7 sm:px-10"
        >
          <div className="kicker">Profiles</div>
          <h3 className="mt-2 text-2xl uppercase leading-[0.96] tracking-[-0.05em]">
            Re-sync Letterboxd
          </h3>
          <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.4] text-muted">
            Pull the latest watchlist and ratings from Letterboxd.
          </p>
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
        <BlendResultsView
          results={blend.results}
          participants={blend.participants}
        />
      </div>
    );
  }

  return (
    <section className="grid min-h-[calc(100dvh-var(--chrome-header)-var(--chrome-footer))] grid-cols-1 border-b border-ink lg:grid-cols-[minmax(220px,300px)_1fr]">
      <aside className="flex flex-col justify-between gap-8 border-b border-ink bg-paper2/35 px-6 py-7 lg:border-b-0 lg:border-r">
        <div>
          <div className="kicker">Connect</div>
          <h2 className="mt-3 text-xl leading-[1] tracking-[-0.045em]">
            Add both profiles.
          </h2>
        </div>
      </aside>

      <div className="p-6 sm:p-9">
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

        <div className="relative z-10 mt-7 border border-ink bg-paper p-5">
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
