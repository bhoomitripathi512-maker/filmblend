import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/api/security";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function POST() {
  if (!isSupabaseConfigured()) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Supabase is not configured. Add env vars to .env.local" },
        { status: 503 },
      ),
    );
  }

  const slug = nanoid(10);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("blends")
    .insert({ slug, status: "waiting" })
    .select("id, slug, status, created_at")
    .single();

  if (error) {
    return applySecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 500 }),
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return applySecurityHeaders(
    NextResponse.json({
      id: data.id,
      slug: data.slug,
      status: data.status,
      shareUrl: `${baseUrl}/blend/${data.slug}`,
      createdAt: data.created_at,
    }),
  );
}
