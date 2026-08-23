import { notFound, rateLimit, rateLimited } from "@/lib/api-response";

// `/v1/*` is the versioned alias of the public API — the real endpoints are
// rewritten onto their unversioned handlers in next.config.ts, so only the
// misses land here. Same JSON problem document as `/api/*`, so a client that
// versioned its base URL gets an identical error shape either way.
export const runtime = "nodejs";

export function GET(request: Request): Response {
  const path = new URL(request.url).pathname;
  const state = rateLimit(request);
  if (!state.ok) return rateLimited(state, path);
  return notFound(path, state.headers);
}
