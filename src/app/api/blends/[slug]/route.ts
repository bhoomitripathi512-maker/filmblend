import { NextResponse } from "next/server";
import { applySecurityHeaders, parseBlendSlug } from "@/lib/api/security";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { BlendResults, ParticipantData } from "@/types/blend";

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

function latestSyncAt(participants: ParticipantData[]): string | null {
  const times = participants
    .map((p) => p.syncedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  return times[times.length - 1] ?? null;
}

function isCacheValid(
  resultsComputedAt: string | null,
  participants: ParticipantData[],
): boolean {
  if (!resultsComputedAt) return false;
  const latest = latestSyncAt(participants);
  if (!latest) return true;
  return new Date(resultsComputedAt) >= new Date(latest);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug: rawSlug } = await params;
    const slug = parseBlendSlug(rawSlug);

    if (!slug) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Invalid blend link." }, { status: 400 }),
      );
    }

    if (!isSupabaseConfigured()) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Supabase is not configured" },
          { status: 503 },
        ),
      );
    }

    const supabase = createAdminClient();
    const blendSelect = await supabase
      .from("blends")
      .select("id, slug, status, created_at, results_json, results_computed_at")
      .eq("slug", slug)
      .single();

    let blend = blendSelect.data;
    let cacheEnabled = !blendSelect.error;

    if (blendSelect.error) {
      const fallback = await supabase
        .from("blends")
        .select("id, slug, status, created_at")
        .eq("slug", slug)
        .single();

      if (fallback.error || !fallback.data) {
        return applySecurityHeaders(
          NextResponse.json({ error: "Blend not found" }, { status: 404 }),
        );
      }

      blend = { ...fallback.data, results_json: null, results_computed_at: null };
      cacheEnabled = false;
    }

    if (!blend) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Blend not found" }, { status: 404 }),
      );
    }

    const { data: participants } = await supabase
      .from("blend_participants")
      .select("*")
      .eq("blend_id", blend.id)
      .order("slot");

    const mapped = (participants ?? []).map(mapParticipant);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    let results: BlendResults | null = null;

    if (mapped.length === 2 && cacheEnabled) {
      const cached = blend.results_json as BlendResults | null;
      if (
        cached &&
        isCacheValid(blend.results_computed_at as string | null, mapped)
      ) {
        results = cached;
      }
    }

    return applySecurityHeaders(
      NextResponse.json({
        id: blend.id,
        slug: blend.slug,
        status: blend.status,
        participants: mapped,
        results,
        shareUrl: `${baseUrl}/blend/${blend.slug}`,
        createdAt: blend.created_at,
      }),
    );
  } catch (error) {
    console.error("Blend fetch error:", error);
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Failed to load blend" },
        { status: 500 },
      ),
    );
  }
}
