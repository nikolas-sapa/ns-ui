import { notFound, rateLimit, rateLimited } from "@/lib/api-response";

// Catch-all for `/api/*` paths that no route handles.
//
// Without it, `GET /api/anything-wrong` renders the site's HTML 404 — a
// 40KB document with a component demo in it — to a client that sent
// `Accept: application/json` and can only parse JSON. Next resolves static
// routes before this one, so every real endpoint is unaffected; this only
// catches the misses.
export const runtime = "nodejs";

function handle(request: Request): Response {
  const path = new URL(request.url).pathname;
  const state = rateLimit(request);
  if (!state.ok) return rateLimited(state, path);
  return notFound(path, state.headers);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
