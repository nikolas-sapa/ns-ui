// Single source of truth for the registry's public origin. Both the build
// scripts (plain node, run via `npm run registry:build`) and the client-side
// showcase component read this same env var, so the two can never drift
// apart the way they just did (llms.txt pointed at design.helpmarq.com while
// the showcase pointed at ns-ui-registry.vercel.app).
//
// design.helpmarq.com is now live (cert issued, serving the full registry) and
// is the canonical origin, so it is the DEFAULT rather than an env-only
// override. That matters: the env var is only set on Vercel, so while the
// fallback pointed at the vercel.app host, any local build, fresh clone or
// artifact generated off-platform baked the wrong URL into llms.txt,
// registry.json and every install command. ns-ui-registry.vercel.app still
// serves the identical files as an alias.
// `??` would only fall back on null/undefined, so a var that is SET BUT EMPTY
// (`NEXT_PUBLIC_REGISTRY_ORIGIN=` in an env file, which is how .env.local ships)
// yielded "" and blew up `new URL(REGISTRY_ORIGIN)` in app/layout.tsx with a
// bare `ERR_INVALID_URL: input: ''` during "Collecting page data for
// /_not-found" — a build failure that names neither the variable nor the file.
// Trim-and-check so empty and whitespace-only both fall through to the default.
export const REGISTRY_ORIGIN =
  process.env.NEXT_PUBLIC_REGISTRY_ORIGIN?.trim() || "https://design.helpmarq.com";
