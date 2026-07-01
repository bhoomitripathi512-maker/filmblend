"use client";

import { useEffect, useState } from "react";

const QUOTES = [
  { text: "I'll be back.", film: "The Terminator" },
  { text: "May the Force be with you.", film: "Star Wars" },
  { text: "Here's looking at you, kid.", film: "Casablanca" },
  { text: "Why so serious?", film: "The Dark Knight" },
  { text: "To infinity and beyond!", film: "Toy Story" },
  { text: "Life finds a way.", film: "Jurassic Park" },
  { text: "I'm gonna make him an offer he can't refuse.", film: "The Godfather" },
  { text: "Just keep swimming.", film: "Finding Nemo" },
];

export function BlendLoading({ done }: { done?: boolean }) {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const quoteTimer = window.setInterval(() => {
      setQuoteIndex((current) => (current + 1) % QUOTES.length);
    }, 3000);

    return () => window.clearInterval(quoteTimer);
  }, []);

  useEffect(() => {
    if (done) return;

    const progressTimer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 90) return current;
        const step = current < 50 ? 4 : current < 75 ? 2 : 1;
        return Math.min(90, current + step);
      });
    }, 800);

    return () => window.clearInterval(progressTimer);
  }, [done]);

  const quote = QUOTES[quoteIndex];
  const displayProgress = done ? 100 : progress;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16">
      <div className="kicker">Now blending</div>

      <div className="relative mb-8 mt-7 flex h-20 w-20 items-center justify-center">
        <div className="pointer-events-none absolute inset-0 animate-spin rounded-full border border-ink border-t-green" />
        <div className="relative flex h-12 w-12 flex-col items-center justify-center border border-ink bg-cream">
          <div className="h-1.5 w-7 bg-ink" />
          <div className="mt-1.5 flex gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green [animation-delay:300ms]" />
          </div>
        </div>
      </div>

      <blockquote className="max-w-md text-center">
        <p className="text-xl leading-[1.12] tracking-[-0.035em] text-ink">
          &ldquo;{quote.text}&rdquo;
        </p>
        <footer className="mt-3 text-xs uppercase tracking-[0.08em] text-muted">
          — {quote.film}
        </footer>
      </blockquote>

      <div className="mt-10 w-full max-w-sm">
        <div className="mb-2 flex justify-between text-xs uppercase tracking-[0.08em] text-muted">
          <span>Blending profiles</span>
          <span>{displayProgress}%</span>
        </div>
        <div className="h-2 overflow-hidden border border-ink bg-paper2">
          <div
            className="h-full bg-ink transition-all duration-500 ease-out"
            style={{ width: `${displayProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
