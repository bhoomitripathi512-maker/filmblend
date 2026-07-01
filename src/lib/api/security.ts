import { NextResponse } from "next/server";

/** Letterboxd usernames: letters, numbers, hyphen, underscore. */
const LETTERBOXD_USERNAME = /^[a-zA-Z0-9_-]{1,30}$/;

/** nanoid slugs issued by POST /api/blends. */
const BLEND_SLUG = /^[A-Za-z0-9_-]{8,14}$/;

const MAX_JSON_BYTES = 8_192;

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
};

export function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export function jsonError(message: string, status: number): NextResponse {
  return applySecurityHeaders(NextResponse.json({ error: message }, { status }));
}

export function parseBlendSlug(raw: string | undefined): string | null {
  const slug = raw?.trim();
  if (!slug || !BLEND_SLUG.test(slug)) return null;
  return slug;
}

export function parseLetterboxdUsername(raw: string | undefined): string | null {
  const username = raw?.trim();
  if (!username || !LETTERBOXD_USERNAME.test(username)) return null;
  return username;
}

export function parseParticipantSlot(raw: unknown): 1 | 2 | null {
  return raw === 1 || raw === 2 ? raw : null;
}

export async function readBoundedJson<T>(
  request: Request,
  maxBytes = MAX_JSON_BYTES,
): Promise<T | null> {
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader) {
    const length = Number.parseInt(lengthHeader, 10);
    if (Number.isFinite(length) && length > maxBytes) return null;
  }

  const text = await request.text();
  if (text.length > maxBytes) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

export interface RateLimitRule {
  id: string;
  limit: number;
  windowMs: number;
}

export function checkRateLimit(
  key: string,
  rule: RateLimitRule,
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const bucketKey = `${rule.id}:${key}`;
  const existing = rateLimitStore.get(bucketKey);

  if (!existing || now >= existing.resetAt) {
    rateLimitStore.set(bucketKey, {
      count: 1,
      resetAt: now + rule.windowMs,
    });
    return { allowed: true };
  }

  if (existing.count >= rule.limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  rateLimitStore.set(bucketKey, existing);
  return { allowed: true };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export const API_RATE_LIMITS = {
  createBlend: { id: "create-blend", limit: 24, windowMs: 60 * 60 * 1000 },
  connect: { id: "connect", limit: 40, windowMs: 60 * 60 * 1000 },
  compute: { id: "compute", limit: 16, windowMs: 60 * 60 * 1000 },
  readBlend: { id: "read-blend", limit: 240, windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

export function enforceRateLimit(
  request: Request,
  rule: RateLimitRule,
): NextResponse | null {
  const ip = clientIp(request);
  const result = checkRateLimit(ip, rule);
  if (result.allowed) return null;

  const response = jsonError(
    "Too many requests. Please wait a moment and try again.",
    429,
  );
  if (result.retryAfterSec) {
    response.headers.set("Retry-After", String(result.retryAfterSec));
  }
  return response;
}

export function assertProductionDatabaseKey(): void {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL === "1" &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must be set in production. Do not use the anon key for server writes.",
    );
  }
}
