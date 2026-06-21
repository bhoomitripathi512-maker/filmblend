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
    if (done) {
      setProgress(100);
      return;
    }

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

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-12">
      <div className="relative mb-10 flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-lb-graphite border-t-lb-green" />
        <div className="relative flex h-14 w-14 flex-col items-center justify-center rounded-md border-2 border-lb-pewter bg-lb-carbon">
          <div className="h-1.5 w-8 rounded-sm bg-lb-green" />
          <div className="mt-1 flex gap-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-lb-star" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-lb-star [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-lb-star [animation-delay:300ms]" />
          </div>
        </div>
      </div>

      <blockquote className="max-w-md text-center">
        <p className="text-lg italic text-lb-white">&ldquo;{quote.text}&rdquo;</p>
        <footer className="mt-2 text-sm text-lb-fog">— {quote.film}</footer>
      </blockquote>

      <div className="mt-10 w-full max-w-sm">
        <div className="mb-2 flex justify-between text-xs text-lb-fog">
          <span>Blending your Letterboxd profiles…</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-lb-void">
          <div
            className="h-full rounded-full bg-lb-green transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
