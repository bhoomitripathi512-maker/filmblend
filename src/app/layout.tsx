import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Filmblend — find the film between two tastes",
  description:
    "Enter two Letterboxd handles. Filmblend turns overlap, ratings, watchlists, and hidden affinities into a curated double-feature shortlist.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <header className="sticky top-0 z-40 grid h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-ink bg-paper/90 px-5 backdrop-blur-md sm:px-7">
          <Link
            href="/"
            aria-label="Filmblend home"
            className="flex items-center gap-2.5 text-[18px] font-extrabold tracking-[-0.055em]"
          >
            <span>FILMBLEND</span>
            <span className="mark" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </span>
          </Link>
          <nav
            aria-label="Sections"
            className="hidden justify-center gap-6 text-xs uppercase tracking-[0.09em] md:flex"
          >
            <Link href="/" className="opacity-70 hover:opacity-100">
              Start
            </Link>
            <a href="#blend" className="opacity-70 hover:opacity-100">
              Blend
            </a>
            <a href="#films" className="opacity-70 hover:opacity-100">
              Films
            </a>
            <a href="#taste" className="opacity-70 hover:opacity-100">
              Taste
            </a>
            <a href="#recs" className="opacity-70 hover:opacity-100">
              Recommended
            </a>
          </nav>
          <div className="flex items-center justify-end gap-3">
            <Link href="/" className="btn fill">
              New blend
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1">{children}</main>
        <footer className="flex flex-col justify-between gap-2 border-t border-ink px-7 py-6 text-xs uppercase tracking-[0.08em] text-muted sm:flex-row">
          <span>Not affiliated with Letterboxd or MUBI.</span>
          <span>Film data enriched via TMDB</span>
        </footer>
      </body>
    </html>
  );
}
