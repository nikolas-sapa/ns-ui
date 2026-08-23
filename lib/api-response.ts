// Shared response shape for the public API: RFC 9457 problem documents for
// every error, and RFC 9331 RateLimit headers on every response.
//
// Both exist because agents, not browsers, are the main clients here. An HTML
// 404 page is unparseable to a tool that expected JSON, and a client with no
// rate signal either hammers the origin or crawls conservatively for no
// reason. Neither is a hypothetical: an agent-readiness audit probed this API
// and found HTML errors and no rate headers.

import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

/**
 * Per-instance sliding window.
 *
 * ponytail: an in-memory Map, not a shared store. The honest ceiling is that
 * each serverless instance counts its own traffic, so the effective limit is
 * `LIMIT x instances` rather than `LIMIT` — fine for a public, cacheable,
 * read-only API whose real protection is the CDN, and the headers stay
 * truthful about what THIS instance will accept. Swap in Convex or Upstash if
 * this ever needs to be a real quota rather than a self-throttling hint.
 */
const WINDOW_MS = 60_000;
const LIMIT = 120;
const hits = new Map<string, number[]>();

/** Trim the map so a long-lived instance cannot grow it without bound. */
function sweep(now: number) {
  if (hits.size < 5_000) return;
  for (const [key, times] of hits) {
    if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
  }
}

export type RateState = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window frees up. */
  reset: number;
  headers: Record<string, string>;
};

export function rateLimit(request: Request): RateState {
  // Vercel sets x-forwarded-for; the fallback bucket is shared, which only
  // matters in local dev where every request looks the same anyway.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const now = Date.now();
  sweep(now);

  const times = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  const ok = times.length < LIMIT;
  if (ok) times.push(now);
  hits.set(ip, times);

  const oldest = times[0] ?? now;
  const reset = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
  const remaining = Math.max(0, LIMIT - times.length);

  return {
    ok,
    remaining,
    reset,
    headers: {
      // RFC 9331 draft field names, the pair every client library reads.
      "RateLimit-Limit": String(LIMIT),
      "RateLimit-Remaining": String(remaining),
      "RateLimit-Reset": String(reset),
      "RateLimit-Policy": `${LIMIT};w=${WINDOW_MS / 1000}`,
    },
  };
}

export type ProblemInit = {
  status: number;
  /** Machine-readable slug, the thing an agent branches on. */
  code: string;
  title: string;
  detail: string;
  /** What to do about it — the field that turns an error into a next step. */
  resolution?: string;
  instance?: string;
  extra?: Record<string, unknown>;
};

/**
 * An RFC 9457 `application/problem+json` response.
 *
 * `type` is a real URL on this site rather than `about:blank`: it points at
 * the docs section that explains the code, so a client that follows it gets
 * prose instead of a 404.
 */
export function problem(init: ProblemInit, headers: Record<string, string> = {}): Response {
  const body = {
    type: `${REGISTRY_ORIGIN}/docs#errors`,
    title: init.title,
    status: init.status,
    detail: init.detail,
    code: init.code,
    ...(init.resolution ? { resolution: init.resolution } : {}),
    ...(init.instance ? { instance: init.instance } : {}),
    ...(init.extra ?? {}),
  };
  return new Response(JSON.stringify(body, null, 2), {
    status: init.status,
    headers: {
      "content-type": "application/problem+json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

/** The 429 every rate-limited route returns, with the Retry-After agents read. */
export function rateLimited(state: RateState, instance: string): Response {
  return problem(
    {
      status: 429,
      code: "rate_limited",
      title: "Too many requests",
      detail: `This instance accepts ${LIMIT} requests per ${WINDOW_MS / 1000}s per client.`,
      resolution: `Wait ${state.reset}s and retry. Every response carries RateLimit-Remaining and RateLimit-Reset so you can pace without hitting this.`,
      instance,
    },
    { ...state.headers, "retry-after": String(state.reset) },
  );
}

/** The 404 shape shared by every unmatched API path. */
export function notFound(instance: string, headers: Record<string, string> = {}): Response {
  return problem(
    {
      status: 404,
      code: "not_found",
      title: "No such endpoint",
      detail: `${instance} is not an endpoint on this API.`,
      resolution: `Every public endpoint is listed at ${REGISTRY_ORIGIN}/docs and described at ${REGISTRY_ORIGIN}/openapi.json.`,
      instance,
    },
    headers,
  );
}
