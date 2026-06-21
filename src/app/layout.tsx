import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0c0c0f] text-zinc-100">
        <header className="border-b border-white/5">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-bold text-white">
              Film<span className="text-orange-400">blend</span>
            </Link>
            <Link
              href="/"
              className="text-sm text-zinc-400 transition hover:text-white"
            >
              New blend
            </Link>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="border-t border-white/5 py-6 text-center text-xs text-zinc-600">
          Not affiliated with Letterboxd. Film data enriched via TMDB.
        </footer>
      </body>
    </html>
  );
}
