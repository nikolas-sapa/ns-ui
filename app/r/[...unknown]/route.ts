import { notFound, problem, rateLimit, rateLimited } from "@/lib/api-response";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

// `/r/<name>.json` is a real static file for every component that exists; the
// filesystem serves those and never reaches this handler. What reaches it is
// a miss — a renamed slug, a typo, a stale link from an old CLI — which
// otherwise returned the HTML 404 page to `npx shadcn add`.
//
// The name is echoed back with a pointer at the index, because "which name
// did I get wrong" is the only question a client has at this point.
export const runtime = "nodejs";

export function GET(request: Request): Response {
  const path = new URL(request.url).pathname;
  const state = rateLimit(request);
  if (!state.ok) return rateLimited(state, path);

  const slug = path.replace(/^\/r\//, "").replace(/\.json$/, "");
  if (!slug) return notFound(path, state.headers);

  return problem(
    {
      status: 404,
      code: "component_not_found",
      title: "No such component",
      detail: `No component named "${slug}" exists in this registry.`,
      resolution: `Check the index at ${REGISTRY_ORIGIN}/registry.json, or search it with the MCP server at ${REGISTRY_ORIGIN}/.well-known/mcp. Components renamed before 2026-08 redirect from their old slugs on /components/<name>.`,
      instance: path,
      extra: { requestedName: slug },
    },
    state.headers,
  );
}
