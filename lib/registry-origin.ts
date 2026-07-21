// Single source of truth for the registry's public origin. Both the build
// scripts (plain node, run via `npm run registry:build`) and the client-side
// showcase component read this same env var, so the two can never drift
// apart the way they just did (llms.txt pointed at design.helpmarq.com while
// the showcase pointed at ns-ui-registry.vercel.app).
//
// design.helpmarq.com is the intended custom domain but its DNS record
// hasn't resolved yet, so the default stays the origin that resolves today.
// Once DNS resolves: set NEXT_PUBLIC_REGISTRY_ORIGIN=https://design.helpmarq.com
// in Vercel (all environments) and redeploy — no source change needed.
export const REGISTRY_ORIGIN =
  process.env.NEXT_PUBLIC_REGISTRY_ORIGIN ?? "https://ns-ui-registry.vercel.app";
