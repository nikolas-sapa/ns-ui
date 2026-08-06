import type { NextConfig } from "next";
import { renameRedirects } from "./lib/rename-redirects";

const nextConfig: NextConfig = {
  // keep corpus screenshots clean
  devIndicators: false,
  // `/registry.json` is the conventional root path a shadcn-registry-aware
  // agent tries first; the actual index is emitted (by `shadcn build`) at
  // `/r/registry.json` alongside the per-component files. Rewrite so both
  // paths serve the same static file instead of hand-copying it — this runs
  // at request time so it works on a clean Vercel build with no extra script
  // step, and can't drift from the file `shadcn build` regenerates.
  async rewrites() {
    return [{ source: "/registry.json", destination: "/r/registry.json" }];
  },
  // Repairs the 223 pre-rename slugs that the published CLI still hands out
  // and that 404 today. Generated from `docs/rename-map.tsv`, never
  // hand-listed — see `lib/rename-redirects.ts` for why this layer exists
  // despite the freeze decision having rejected redirects.
  async redirects() {
    return [
      // Rename-specific pairs first: an old, renamed slug's `/play` link has
      // its own one-hop rule straight to the new slug's component page (see
      // `lib/rename-redirects.ts`). Ordered ahead of the generic rule below
      // so it wins the match instead of bouncing through `/components/<old>`
      // first.
      ...renameRedirects(process.cwd()),
      // `/preview/<name>/play` no longer exists for any current slug —
      // everything it uniquely had (source, build spec) moved onto
      // `/components/<name>`, which already rendered the same DemoStage.
      // Permanent, not just for old external links and the owner's own
      // recordings, but because `/components/<name>` is genuinely the
      // correct destination now, not a temporary detour.
      {
        source: "/preview/:name/play",
        destination: "/components/:name",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
