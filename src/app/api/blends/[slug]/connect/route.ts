import { NextResponse } from "next/server";
import { LetterboxdError, syncLetterboxdUser } from "@/lib/letterboxd/fetcher";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  let body: { username?: string; slot?: 1 | 2 };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = body.username?.trim();
  const slot = body.slot;

  if (!username) {
    return NextResponse.json(
      { error: "Letterboxd username is required" },
      { status: 400 },
    );
  }

  if (slot !== 1 && slot !== 2) {
    return NextResponse.json(
      { error: "Slot must be 1 or 2" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: blend, error: blendError } = await supabase
    .from("blends")
    .select("id, status")
    .eq("slug", slug)
    .single();

  if (blendError || !blend) {
    return NextResponse.json({ error: "Blend not found" }, { status: 404 });
  }

  let synced;
  try {
    synced = await syncLetterboxdUser(username);
  } catch (err) {
    if (err instanceof LetterboxdError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Letterboxd sync error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to sync Letterboxd profile";
    return NextResponse.json({ error: message }, { status: 500 });
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
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
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

  return NextResponse.json({
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
    },
  });
}
