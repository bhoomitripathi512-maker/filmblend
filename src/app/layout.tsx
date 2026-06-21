import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Filmblend — Letterboxd taste blends",
  description:
    "Create a Spotify-style blend for two Letterboxd users. Find shared movies, genres, and films to watch together.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-lb-void text-lb-pewter">
        <header className="border-b border-lb-graphite">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-bold text-lb-white">
              Film<span className="text-lb-green">blend</span>
            </Link>
            <Link
              href="/"
              className="text-sm text-lb-fog transition hover:text-lb-white"
            >
              New blend
            </Link>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="border-t border-lb-graphite py-6 text-center text-xs text-lb-fog">
          Not affiliated with Letterboxd. Film data enriched via TMDB.
        </footer>
      </body>
    </html>
  );
}
