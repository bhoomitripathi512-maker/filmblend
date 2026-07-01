import { NextResponse, type NextRequest } from "next/server";
import {
  API_RATE_LIMITS,
  applySecurityHeaders,
  checkRateLimit,
  clientIp,
  jsonError,
  parseBlendSlug,
} from "@/lib/api/security";

function rateLimitForPath(pathname: string): (typeof API_RATE_LIMITS)[keyof typeof API_RATE_LIMITS] | null {
  if (pathname === "/api/blends") return API_RATE_LIMITS.createBlend;
  if (/^\/api\/blends\/[^/]+\/connect$/.test(pathname)) {
    return API_RATE_LIMITS.connect;
  }
  if (/^\/api\/blends\/[^/]+\/compute$/.test(pathname)) {
    return API_RATE_LIMITS.compute;
  }
  if (/^\/api\/blends\/[^/]+$/.test(pathname)) {
    return API_RATE_LIMITS.readBlend;
  }
  return null;
}

function slugFromApiPath(pathname: string): string | null {
  const match = pathname.match(/^\/api\/blends\/([^/]+)(?:\/|$)/);
  return match?.[1] ?? null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return applySecurityHeaders(NextResponse.next());
  }

  const slugSegment = slugFromApiPath(pathname);
  if (slugSegment && !parseBlendSlug(slugSegment)) {
    return jsonError("Invalid blend link.", 400);
  }

  const rule = rateLimitForPath(pathname);
  if (rule) {
    const ip = clientIp(request);
    const result = checkRateLimit(ip, rule);
    if (!result.allowed) {
      const response = jsonError(
        "Too many requests. Please wait a moment and try again.",
        429,
      );
      if (result.retryAfterSec) {
        response.headers.set("Retry-After", String(result.retryAfterSec));
      }
      return response;
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/api/:path*"],
};
