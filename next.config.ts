import type { NextConfig } from "next";

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
};

export default nextConfig;
