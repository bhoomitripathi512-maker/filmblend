const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function isNetworkFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  if (error.name === "TimeoutError" || error.name === "AbortError") {
    return true;
  }

  const message = error.message.toLowerCase();
  if (
    message.includes("fetch failed") ||
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("econnrefused") ||
    message.includes("enotfound")
  ) {
    return true;
  }

  const cause = error.cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    const code = String(cause.code).toUpperCase();
    return (
      code.includes("TIMEOUT") ||
      code.includes("ECONNREFUSED") ||
      code.includes("ENOTFOUND") ||
      code.includes("ECONNRESET")
    );
  }

  return false;
}

export function letterboxdProxyBase(): string | null {
  return process.env.LETTERBOXD_PROXY_URL?.replace(/\/$/, "") ?? null;
}

export async function fetchViaProxy(
  proxyBase: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(
    `${proxyBase}?url=${encodeURIComponent(url)}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
      ...init,
    },
  );

  return response;
}

export async function fetchDirect(
  url: string,
  accept: string,
): Promise<Response> {
  return fetch(url, {
    headers: {
      Accept: accept,
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
}

export async function fetchWithProxyFallback(
  url: string,
  accept: string,
): Promise<Response> {
  const proxyBase = letterboxdProxyBase();

  if (proxyBase) {
    try {
      const response = await fetchViaProxy(proxyBase, url, {
        headers: { Accept: accept },
      });
      return response;
    } catch (error) {
      if (!isNetworkFetchError(error)) throw error;
      console.warn(
        "Letterboxd proxy unavailable, falling back to direct fetch:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return fetchDirect(url, accept);
}
