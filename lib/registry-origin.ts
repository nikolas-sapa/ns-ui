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
export const REGISTRY_ORIGIN =
  process.env.NEXT_PUBLIC_REGISTRY_ORIGIN ?? "https://design.helpmarq.com";
