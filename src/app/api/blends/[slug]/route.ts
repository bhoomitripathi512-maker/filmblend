import { NextResponse } from "next/server";
import { computeBlendResults } from "@/lib/blend/compute";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ParticipantData } from "@/types/blend";

function mapParticipant(row: Record<string, unknown>): ParticipantData {
  return {
    slot: row.slot as 1 | 2,
    letterboxdUsername: row.letterboxd_username as string,
    displayName: (row.display_name as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    filmsWatched: (row.films_watched as ParticipantData["filmsWatched"]) ?? [],
    filmsWatchlist:
      (row.films_watchlist as ParticipantData["filmsWatchlist"]) ?? [],
    filmsRated: (row.films_rated as ParticipantData["filmsRated"]) ?? [],
    genreStats: (row.genre_stats as ParticipantData["genreStats"]) ?? [],
    directorStats:
      (row.director_stats as ParticipantData["directorStats"]) ?? [],
    syncedAt: (row.synced_at as string | null) ?? null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();
  const { data: blend, error } = await supabase
    .from("blends")
    .select("id, slug, status, created_at")
    .eq("slug", slug)
    .single();

  if (error || !blend) {
    return NextResponse.json({ error: "Blend not found" }, { status: 404 });
  }

  const { data: participants } = await supabase
    .from("blend_participants")
    .select("*")
    .eq("blend_id", blend.id)
    .order("slot");

  const mapped = (participants ?? []).map(mapParticipant);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let results = null;
  if (mapped.length === 2) {
    results = await computeBlendResults(mapped);
  }

  return NextResponse.json({
    id: blend.id,
    slug: blend.slug,
    status: blend.status,
    participants: mapped,
    results,
    shareUrl: `${baseUrl}/blend/${blend.slug}`,
    createdAt: blend.created_at,
  });
}
