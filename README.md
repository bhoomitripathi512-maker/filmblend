# Filmblend

A Spotify Blend-style web app for two Letterboxd users. Create a shareable link, both people connect their Letterboxd profiles, and see:

- **Movie Match** — films you both watched and have on your watchlists
- **Genre Match** — shared favorite genres and viewing habits
- **Watch Together** — watchlist picks neither of you has watched yet
- **Director Match** — directors you both love

Built with **Next.js**, **Supabase**, and **Vercel**. Works across devices — blends are stored in the cloud.

## Letterboxd connection

Letterboxd does not offer public API access for blend/recommendation apps. Filmblend uses **public Letterboxd usernames** to fetch watchlists and watched films (same approach as [Matchboxd](https://matchboxd.com)).

Requirements:
- Both users need **public** Letterboxd profiles
- Watchlist and watched films must be visible publicly

## Quick start

### 1. Clone and install

```bash
cd ~/Projects/filmblend
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations in `supabase/migrations/` via the SQL Editor (run `002_films_rated.sql` if you already ran `001`)
3. Copy `.env.example` to `.env.local` and add your Supabase URL and service role key

### 3. TMDB (optional but recommended)

Get a free API key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) for movie posters and genre metadata.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create a blend, and share the link.

## Deploy to Vercel

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add environment variables from `.env.example`
4. Set `NEXT_PUBLIC_APP_URL` to your production domain

## How it works

```
Landing → Create blend → Share link → Both connect Letterboxd → View results
```

1. User A clicks **Create a blend link**
2. User A connects their Letterboxd username (slot 1)
3. User A shares the link with User B
4. User B opens the link on any device and connects (slot 2)
5. Both see:
   - **Shared Watchlist** — films on both watchlists
   - **Watch Together Next** — shared watchlist films neither has seen
   - **Common Taste Profile** — shared genres, directors, and mutually high-rated films (4★+)
   - **Genre Picks** — recommendations per shared genre
   - **Recommended for You Both** — suggestions from TMDB based on shared taste

## Project structure

```
src/
  app/                  # Next.js App Router pages & API routes
  components/           # UI components
  lib/
    letterboxd/         # Public profile data fetcher
    blend/              # Blend computation logic
    supabase/           # Database client
    tmdb/               # Movie metadata enrichment
supabase/migrations/    # Database schema
```

## Future improvements

- Letterboxd OAuth (requires API approval from Letterboxd)
- CSV export import for private watchlist data
- Re-sync button to refresh stale data
- Streaming availability links
