import { NextResponse } from "next/server";
import {
  applySecurityHeaders,
  parseBlendSlug,
  parseLetterboxdUsername,
  parseParticipantSlot,
  readBoundedJson,
} from "@/lib/api/security";
import { LetterboxdError, syncLetterboxdUser } from "@/lib/letterboxd/fetcher";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
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

  const body = await readBoundedJson<{ username?: string; slot?: unknown }>(
    request,
  );
  if (!body) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    );
  }

  const username = parseLetterboxdUsername(body.username);
  const slot = parseParticipantSlot(body.slot);

  if (!username) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Enter a valid Letterboxd username (letters, numbers, - and _ only)." },
        { status: 400 },
      ),
    );
  }

  if (!slot) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Slot must be 1 or 2" },
        { status: 400 },
      ),
    );
  }

  const supabase = createAdminClient();
  const { data: blend, error: blendError } = await supabase
    .from("blends")
    .select("id, status")
    .eq("slug", slug)
    .single();

  if (blendError || !blend) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Blend not found" }, { status: 404 }),
    );
  }

  let synced;
  try {
    synced = await syncLetterboxdUser(username);
  } catch (err) {
    if (err instanceof LetterboxdError) {
      return applySecurityHeaders(
        NextResponse.json({ error: err.message }, { status: err.status }),
      );
    }
    console.error("Letterboxd sync error:", err);
    return applySecurityHeaders(
      NextResponse.json({ error: "Failed to sync Letterboxd profile" }, { status: 500 }),
    );
  }

  const { data: existingSlot } = await supabase
    .from("blend_participants")
    .select("id")
    .eq("blend_id", blend.id)
    .eq("slot", slot)
    .maybeSingle();

  const participantRow = {
    blend_id: blend.id,
    slot,
    letterboxd_username: synced.username,
    display_name: synced.displayName,
    avatar_url: synced.avatarUrl,
    films_watched: synced.filmsWatched,
    films_watchlist: synced.filmsWatchlist,
    films_rated: synced.filmsRated,
    genre_stats: synced.genreStats,
    director_stats: synced.directorStats,
    synced_at: synced.syncedAt,
  };

  const { error: upsertError } = existingSlot
    ? await supabase
        .from("blend_participants")
        .update(participantRow)
        .eq("blend_id", blend.id)
        .eq("slot", slot)
    : await supabase.from("blend_participants").insert(participantRow);

  if (upsertError) {
    return applySecurityHeaders(
      NextResponse.json({ error: upsertError.message }, { status: 500 }),
    );
  }

  const { count } = await supabase
    .from("blend_participants")
    .select("*", { count: "exact", head: true })
    .eq("blend_id", blend.id);

  const newStatus =
    count === 2 ? "complete" : count === 1 ? "partial" : "waiting";

  await supabase
    .from("blends")
    .update({ status: newStatus })
    .eq("id", blend.id);

  await supabase
    .from("blends")
    .update({
      results_json: null,
      results_computed_at: null,
    })
    .eq("id", blend.id);

  return applySecurityHeaders(
    NextResponse.json({
      ok: true,
      status: newStatus,
      participant: {
        slot,
        letterboxdUsername: synced.username,
        displayName: synced.displayName,
        avatarUrl: synced.avatarUrl,
        watchedCount: synced.filmsWatched.length,
        watchlistCount: synced.filmsWatchlist.length,
        ratedCount: synced.filmsRated.length,
        syncedAt: synced.syncedAt,
        syncMode: synced.syncMode,
        watchlistSource:
          "watchlistSource" in synced ? synced.watchlistSource : undefined,
      },
    }),
  );
}
