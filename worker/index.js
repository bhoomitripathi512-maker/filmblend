const ALLOWED_TARGET = /^https:\/\/(www\.)?letterboxd\.com\//;
const USER_AGENT =
  "Mozilla/5.0 (compatible; Filmblend/1.0; +https://filmblend.vercel.app)";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return Response.json({ ok: true, proxy: "filmblend-letterboxd" });
    }

    const target = url.searchParams.get("url");
    if (!target) {
      return Response.json({ error: "Missing ?url= parameter" }, { status: 400 });
    }

    if (!ALLOWED_TARGET.test(target)) {
      return Response.json(
        { error: "Only letterboxd.com URLs are allowed" },
        { status: 403 },
      );
    }

    const upstream = await fetch(target, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/rss+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") || "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  },
};
